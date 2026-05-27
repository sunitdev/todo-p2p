//! Browser iroh transport (E1.2).
//!
//! A `wasm-bindgen` surface (`IrohNode`) that mirrors the desktop transport
//! (`apps/desktop/src-tauri/src/iroh`) so the two interop. Browser endpoints
//! are relay-only — all traffic flows over a WebSocket to an n0 relay — but the
//! QUIC + Noise handshake keeps it end-to-end encrypted. Runs inside a Web
//! Worker driven by `apps/web/src/runtime/irohWorker.ts`.
//!
//! Events are published on a `tokio::sync::broadcast` channel and pulled from
//! JS via `next_event()`. We deliberately do *not* store JS callbacks in Rust
//! (they are `!Send`, which would break the `ProtocolHandler` bounds).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use dashmap::{DashMap, DashSet};
use iroh::endpoint::presets::N0;
use iroh::endpoint::{Connection, VarInt};
use iroh::protocol::{AcceptError, ProtocolHandler, Router};
use iroh::{Endpoint, EndpointAddr, EndpointId, SecretKey};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tokio::sync::broadcast;
use wasm_bindgen::prelude::*;

const SYNC_ALPN: &[u8] = b"todo-p2p/sync/1";
const TICKET_TTL_MS: u64 = 60_000;
const MAX_MSG_BYTES: usize = 64 * 1024 * 1024;
const MAX_AUTH_BYTES: usize = 8 * 1024;
const CLOSE_CODE: u32 = 0;
const EVENT_BUFFER: usize = 1024;

// --- Wire frames (identical to desktop) ------------------------------------

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum AuthFrame {
    Pair { token: String },
    Trusted,
}

#[derive(Serialize, Deserialize)]
struct DialTicket {
    addr: EndpointAddr,
    token: String,
}

// --- DTOs (shapes match the TS TransportAdapter) ---------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PairingTicketDto {
    ticket: String,
    node_id: String,
    psk_hash: Vec<u8>,
    expires_at: u64,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
enum TransportEvent {
    Message { peer_id: String, payload: Vec<u8> },
    PeerStatus(PeerStatusDto),
}

#[derive(Serialize, Clone)]
#[serde(tag = "status", rename_all = "camelCase")]
// `Error` completes the TS PeerStatusEvent contract (connected|disconnected|
// error); M1 surfaces failures as disconnects, so it is not yet constructed.
#[allow(dead_code)]
enum PeerStatusDto {
    Connected { peer_id: String },
    Disconnected { peer_id: String },
    Error { peer_id: String, error: String },
}

// --- Pairing ticket registry (single-use + TTL enforcement point) ----------

struct TicketEntry {
    expires_at_ms: u64,
    used: AtomicBool,
}

#[derive(Default)]
struct PairingRegistry {
    entries: DashMap<String, TicketEntry>,
}

impl PairingRegistry {
    fn mint(&self, token: String, expires_at_ms: u64) {
        self.entries.insert(
            token,
            TicketEntry {
                expires_at_ms,
                used: AtomicBool::new(false),
            },
        );
    }

    fn consume(&self, token: &str) -> bool {
        let Some(entry) = self.entries.get(token) else {
            return false;
        };
        if now_ms() >= entry.expires_at_ms {
            drop(entry);
            self.entries.remove(token);
            return false;
        }
        entry
            .used
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
    }
}

// --- Shared running state --------------------------------------------------

struct Shared {
    endpoint: Endpoint,
    conns: DashMap<String, Connection>,
    trusted: DashSet<String>,
    tickets: PairingRegistry,
    events: broadcast::Sender<TransportEvent>,
}

impl std::fmt::Debug for Shared {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Shared").finish_non_exhaustive()
    }
}

impl Shared {
    async fn start() -> Result<Arc<Self>, String> {
        let secret = SecretKey::generate();
        // N0 preset: relay-only in the browser (no UDP), n0 default relays.
        let endpoint = Endpoint::builder(N0)
            .secret_key(secret)
            .alpns(vec![SYNC_ALPN.to_vec()])
            .bind()
            .await
            .map_err(|e| format!("iroh bind failed: {e}"))?;
        let (events, _rx) = broadcast::channel(EVENT_BUFFER);
        Ok(Arc::new(Self {
            endpoint,
            conns: DashMap::new(),
            trusted: DashSet::new(),
            tickets: PairingRegistry::default(),
            events,
        }))
    }

    fn node_id(&self) -> String {
        self.endpoint.id().to_string()
    }

    fn emit(&self, ev: TransportEvent) {
        let _ = self.events.send(ev);
    }

    fn mint_ticket(&self, ttl_seconds: u32) -> Result<PairingTicketDto, String> {
        let ttl_ms = ((ttl_seconds.max(1)) as u64 * 1000).min(TICKET_TTL_MS);
        let expires_at = now_ms() + ttl_ms;

        let mut psk = [0u8; 32];
        getrandom::fill(&mut psk).map_err(|e| format!("rng: {e}"))?;
        let psk_hash = blake3::hash(&psk);
        let mut token_bytes = [0u8; 16];
        getrandom::fill(&mut token_bytes).map_err(|e| format!("rng: {e}"))?;
        let token = hex::encode(token_bytes);

        self.tickets.mint(token.clone(), expires_at);

        let dial = DialTicket {
            addr: self.endpoint.addr(),
            token,
        };
        let ticket = serde_json::to_string(&dial).map_err(|e| format!("ticket encode: {e}"))?;

        Ok(PairingTicketDto {
            ticket,
            node_id: self.node_id(),
            psk_hash: psk_hash.as_bytes().to_vec(),
            expires_at,
        })
    }

    async fn dial_with_ticket(self: &Arc<Self>, ticket: &str) -> Result<String, String> {
        let dial: DialTicket =
            serde_json::from_str(ticket).map_err(|e| format!("invalid ticket: {e}"))?;
        self.dial(dial.addr, AuthFrame::Pair { token: dial.token })
            .await
    }

    async fn dial_trusted(self: &Arc<Self>, node_id: &str) -> Result<String, String> {
        let id = EndpointId::from_str(node_id).map_err(|e| format!("bad node id: {e}"))?;
        self.dial(EndpointAddr::from(id), AuthFrame::Trusted).await
    }

    async fn dial(self: &Arc<Self>, addr: EndpointAddr, auth: AuthFrame) -> Result<String, String> {
        let conn = self
            .endpoint
            .connect(addr, SYNC_ALPN)
            .await
            .map_err(|e| format!("connect failed: {e}"))?;
        let peer_id = conn.remote_id().to_string();

        let (mut send, mut recv) = conn
            .open_bi()
            .await
            .map_err(|e| format!("open auth stream: {e}"))?;
        let frame = serde_json::to_vec(&auth).map_err(|e| format!("auth encode: {e}"))?;
        send.write_all(&frame)
            .await
            .map_err(|e| format!("auth write: {e}"))?;
        send.finish().map_err(|e| format!("auth finish: {e}"))?;
        let mut verdict = [0u8; 1];
        recv.read_exact(&mut verdict).await.map_err(|_| {
            "peer rejected pairing (ticket invalid, expired, or untrusted)".to_string()
        })?;
        if verdict[0] != 1 {
            conn.close(VarInt::from_u32(CLOSE_CODE), b"rejected");
            return Err("peer rejected pairing".to_string());
        }

        self.trusted.insert(peer_id.clone());
        self.register_and_pump(peer_id.clone(), conn, true);
        Ok(peer_id)
    }

    fn register_and_pump(self: &Arc<Self>, peer_id: String, conn: Connection, spawn: bool) {
        self.conns.insert(peer_id.clone(), conn.clone());
        self.emit(TransportEvent::PeerStatus(PeerStatusDto::Connected {
            peer_id: peer_id.clone(),
        }));
        if spawn {
            let shared = self.clone();
            wasm_bindgen_futures::spawn_local(async move {
                shared.recv_loop(peer_id, conn).await;
            });
        }
    }

    async fn recv_loop(self: Arc<Self>, peer_id: String, conn: Connection) {
        // Loop ends when `accept_bi` errors — the connection was closed / lost.
        while let Ok((_send, mut recv)) = conn.accept_bi().await {
            match recv.read_to_end(MAX_MSG_BYTES).await {
                Ok(payload) => self.emit(TransportEvent::Message {
                    peer_id: peer_id.clone(),
                    payload,
                }),
                Err(_) => { /* drop the malformed stream, keep the connection */ }
            }
        }
        self.conns.remove(&peer_id);
        self.emit(TransportEvent::PeerStatus(PeerStatusDto::Disconnected {
            peer_id,
        }));
    }

    async fn send(&self, peer_id: &str, payload: &[u8]) -> Result<(), String> {
        let conn = self
            .conns
            .get(peer_id)
            .map(|c| c.clone())
            .ok_or_else(|| format!("no live connection to {peer_id}"))?;
        let (mut send, _recv) = conn
            .open_bi()
            .await
            .map_err(|e| format!("open stream: {e}"))?;
        send.write_all(payload)
            .await
            .map_err(|e| format!("send write: {e}"))?;
        send.finish().map_err(|e| format!("send finish: {e}"))?;
        Ok(())
    }

    fn close_peer(&self, peer_id: &str) {
        if let Some((_, conn)) = self.conns.remove(peer_id) {
            conn.close(VarInt::from_u32(CLOSE_CODE), b"closed by peer");
            self.emit(TransportEvent::PeerStatus(PeerStatusDto::Disconnected {
                peer_id: peer_id.to_string(),
            }));
        }
    }
}

fn now_ms() -> u64 {
    js_sys::Date::now() as u64
}

// --- Protocol handler (accept side) ----------------------------------------

#[derive(Clone, Debug)]
struct SyncProtocol {
    shared: Arc<Shared>,
}

impl ProtocolHandler for SyncProtocol {
    async fn accept(&self, conn: Connection) -> Result<(), AcceptError> {
        let peer_id = conn.remote_id().to_string();

        let (mut send, mut recv) = conn.accept_bi().await?;
        let raw = recv
            .read_to_end(MAX_AUTH_BYTES)
            .await
            .map_err(AcceptError::from_err)?;
        let authorized = match serde_json::from_slice::<AuthFrame>(&raw) {
            Ok(AuthFrame::Pair { token }) => {
                let ok = self.shared.tickets.consume(&token);
                if ok {
                    self.shared.trusted.insert(peer_id.clone());
                }
                ok
            }
            Ok(AuthFrame::Trusted) => self.shared.trusted.contains(&peer_id),
            Err(_) => false,
        };

        let verdict = [if authorized { 1u8 } else { 0u8 }];
        let _ = send.write_all(&verdict).await;
        let _ = send.finish();

        if !authorized {
            conn.close(VarInt::from_u32(CLOSE_CODE), b"unauthorized");
            return Ok(());
        }

        self.shared
            .register_and_pump(peer_id.clone(), conn.clone(), false);
        self.shared.clone().recv_loop(peer_id, conn).await;
        Ok(())
    }
}

// --- wasm-bindgen surface --------------------------------------------------

/// Browser handle to an iroh node. One per Worker. Methods return JS Promises
/// (via `future_to_promise`) so the borrow does not outlive the call.
#[wasm_bindgen]
pub struct IrohNode {
    shared: Arc<Shared>,
    _router: Router,
    /// Single drain of the event broadcast, pulled by `next_event`.
    rx: Arc<tokio::sync::Mutex<broadcast::Receiver<TransportEvent>>>,
}

#[wasm_bindgen]
impl IrohNode {
    /// Start the local node. Resolves once the endpoint is bound.
    #[wasm_bindgen]
    pub async fn start() -> Result<IrohNode, JsValue> {
        console_error_panic_hook::set_once();
        let shared = Shared::start().await.map_err(to_js)?;
        let rx = shared.events.subscribe();
        let router = Router::builder(shared.endpoint.clone())
            .accept(SYNC_ALPN, SyncProtocol { shared: shared.clone() })
            .spawn();
        Ok(IrohNode {
            shared,
            _router: router,
            rx: Arc::new(tokio::sync::Mutex::new(rx)),
        })
    }

    #[wasm_bindgen(getter, js_name = nodeId)]
    pub fn node_id(&self) -> String {
        self.shared.node_id()
    }

    #[wasm_bindgen(js_name = mintPairingTicket)]
    pub fn mint_pairing_ticket(&self, ttl_seconds: u32) -> js_sys::Promise {
        let shared = self.shared.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let dto = shared.mint_ticket(ttl_seconds).map_err(to_js)?;
            to_value(&dto)
        })
    }

    #[wasm_bindgen(js_name = dialWithTicket)]
    pub fn dial_with_ticket(&self, ticket: String) -> js_sys::Promise {
        let shared = self.shared.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let peer = shared.dial_with_ticket(&ticket).await.map_err(to_js)?;
            Ok(JsValue::from_str(&peer))
        })
    }

    #[wasm_bindgen(js_name = dialTrusted)]
    pub fn dial_trusted(&self, node_id: String) -> js_sys::Promise {
        let shared = self.shared.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let peer = shared.dial_trusted(&node_id).await.map_err(to_js)?;
            Ok(JsValue::from_str(&peer))
        })
    }

    #[wasm_bindgen]
    pub fn send(&self, peer_id: String, payload: Vec<u8>) -> js_sys::Promise {
        let shared = self.shared.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            shared.send(&peer_id, &payload).await.map_err(to_js)?;
            Ok(JsValue::UNDEFINED)
        })
    }

    #[wasm_bindgen(js_name = closePeer)]
    pub fn close_peer(&self, peer_id: String) {
        self.shared.close_peer(&peer_id);
    }

    /// Await the next transport event (message or peer-status). The Worker
    /// loops this and forwards each event to the main thread.
    #[wasm_bindgen(js_name = nextEvent)]
    pub fn next_event(&self) -> js_sys::Promise {
        let rx = self.rx.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let mut guard = rx.lock().await;
            loop {
                match guard.recv().await {
                    Ok(ev) => return to_value(&ev),
                    // Dropped a lagged event: keep pulling rather than failing.
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(broadcast::error::RecvError::Closed) => return Ok(JsValue::NULL),
                }
            }
        })
    }

    #[wasm_bindgen]
    pub fn stop(&self) {
        // Dropping the router (on handle drop) aborts the accept loop; close the
        // endpoint to release the relay connection promptly.
        let ep = self.shared.endpoint.clone();
        wasm_bindgen_futures::spawn_local(async move {
            ep.close().await;
        });
    }
}

fn to_js(e: String) -> JsValue {
    JsValue::from_str(&e)
}

fn to_value<T: Serialize>(v: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(v).map_err(|e| JsValue::from_str(&e.to_string()))
}
