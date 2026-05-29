//! iroh P2P transport (E1.1).
//!
//! Implements the TypeScript `TransportAdapter` contract (see
//! `packages/core/src/adapters/TransportAdapter.ts`) behind `iroh_*` Tauri
//! commands. Two of the user's own devices pair via a QR ticket and then sync
//! Automerge messages over an iroh QUIC + Noise connection.
//!
//! Security model (mirrors CLAUDE.md / `todo-security`):
//!   - Device identity *is* the iroh `SecretKey`; the QUIC/TLS handshake binds
//!     every connection to the dialed `EndpointId`. That handshake is the
//!     "signature reconnect" — a peer cannot impersonate an id without its key.
//!   - First contact is gated by a single-use, 60s pairing ticket (the
//!     `PairingRegistry` below is the enforcement point — never the UI).
//!   - Reconnects present `AuthFrame::Trusted`; the accepting side only admits
//!     ids it paired with this session (M1 secret key is ephemeral, so trust is
//!     session-scoped — durable trust lands with the M2 keyring).
//!   - We never log the psk, the fingerprint, or message payloads.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::{DashMap, DashSet};
use iroh::endpoint::presets::{N0DisableRelay, N0};
use iroh::endpoint::{Connection, VarInt};
use iroh::protocol::{AcceptError, ProtocolHandler, Router};
use iroh::{Endpoint, EndpointAddr, EndpointId, SecretKey, TransportAddr};
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::str::FromStr;
use tauri::ipc::Channel;
use tauri::State;
use tokio::sync::Mutex;

/// ALPN for the Automerge sync protocol. Bumped if the wire format changes.
const SYNC_ALPN: &[u8] = b"todo-p2p/sync/1";
/// Pairing tickets live for 60 seconds (matches `TICKET_TTL_SECONDS` in core).
const TICKET_TTL_SECONDS: u64 = 60;
/// Upper bound on a single Automerge sync message read off a stream (64 MiB).
const MAX_MSG_BYTES: usize = 64 * 1024 * 1024;
/// Upper bound on the JSON auth frame.
const MAX_AUTH_BYTES: usize = 8 * 1024;
/// QUIC application close code used for all graceful / rejection closes.
const CLOSE_CODE: u32 = 0;

// ---------------------------------------------------------------------------
// Wire frames
// ---------------------------------------------------------------------------

/// First stream a dialer opens. Authorizes the connection before any sync
/// traffic flows. JSON keeps the format forward-compatible.
#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum AuthFrame {
    /// First contact: present the single-use pairing token from the QR ticket.
    Pair { token: String },
    /// Reconnect: identity is proven by the TLS handshake; the accepting side
    /// checks its session trust set.
    Trusted,
}

/// Dialing ticket encoded into the QR payload's `ticket` field. Carries the
/// host address to dial plus the single-use correlation token.
#[derive(Serialize, Deserialize)]
struct DialTicket {
    addr: EndpointAddr,
    token: String,
}

// ---------------------------------------------------------------------------
// DTOs crossing the Tauri IPC boundary (shapes match the TS adapter)
// ---------------------------------------------------------------------------

/// Result of `iroh_mint_pairing_ticket` → TS `PairingTicket`.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PairingTicketDto {
    /// Opaque string scanned from the QR and passed back to `dialWithTicket`.
    ticket: String,
    /// This device's iroh endpoint id (string form).
    node_id: String,
    /// BLAKE3(psk) — raw bytes; the UI hex-encodes for the fingerprint.
    psk_hash: Vec<u8>,
    /// Epoch milliseconds at which the ticket expires.
    expires_at: u64,
}

/// Transport event pushed to the webview over the subscription `Channel`. Maps
/// to the TS adapter's `onMessage` / `onPeerStatus`.
#[derive(Serialize, Clone)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum TransportEvent {
    /// Incoming sync payload from a peer.
    Message { peer_id: String, payload: Vec<u8> },
    /// Peer connection lifecycle.
    PeerStatus(PeerStatusDto),
}

#[derive(Serialize, Clone)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum PeerStatusDto {
    Connected { peer_id: String },
    Disconnected { peer_id: String },
    Error { peer_id: String, error: String },
}

// ---------------------------------------------------------------------------
// Event bus — decouples the accept loop (spawned at start) from the webview
// subscription (attached separately). Events before subscribe are buffered.
// ---------------------------------------------------------------------------

struct EventBus {
    channel: std::sync::Mutex<Option<Channel<TransportEvent>>>,
    pending: std::sync::Mutex<Vec<TransportEvent>>,
    /// Test-only mirror so unit tests can observe emissions without a Channel.
    #[cfg(test)]
    tx: tokio::sync::broadcast::Sender<TransportEvent>,
}

impl EventBus {
    fn new() -> Self {
        #[cfg(test)]
        let (tx, _rx) = tokio::sync::broadcast::channel(1024);
        Self {
            channel: std::sync::Mutex::new(None),
            pending: std::sync::Mutex::new(Vec::new()),
            #[cfg(test)]
            tx,
        }
    }

    fn emit(&self, ev: TransportEvent) {
        #[cfg(test)]
        {
            let _ = self.tx.send(ev.clone());
        }
        let guard = self.channel.lock().expect("event channel mutex poisoned");
        match guard.as_ref() {
            Some(ch) => {
                if let Err(e) = ch.send(ev) {
                    eprintln!("[iroh] event channel send failed: {e}");
                }
            }
            None => self
                .pending
                .lock()
                .expect("event pending mutex poisoned")
                .push(ev),
        }
    }

    #[cfg(test)]
    fn subscribe(&self) -> tokio::sync::broadcast::Receiver<TransportEvent> {
        self.tx.subscribe()
    }

    fn attach(&self, ch: Channel<TransportEvent>) {
        let pending: Vec<TransportEvent> =
            std::mem::take(&mut *self.pending.lock().expect("event pending mutex poisoned"));
        for ev in pending {
            if let Err(e) = ch.send(ev) {
                eprintln!("[iroh] flush event failed: {e}");
            }
        }
        *self.channel.lock().expect("event channel mutex poisoned") = Some(ch);
    }
}

// ---------------------------------------------------------------------------
// Pairing ticket registry — the single-use + TTL enforcement point.
// ---------------------------------------------------------------------------

struct TicketEntry {
    expires_at: Instant,
    used: AtomicBool,
}

#[derive(Default)]
struct PairingRegistry {
    entries: DashMap<String, TicketEntry>,
}

impl PairingRegistry {
    fn mint(&self, token: String, ttl: Duration) {
        self.entries.insert(
            token,
            TicketEntry {
                expires_at: Instant::now() + ttl,
                used: AtomicBool::new(false),
            },
        );
    }

    /// Consume a ticket. Returns `true` exactly once for a live, unused ticket;
    /// every subsequent or expired attempt returns `false`.
    fn consume(&self, token: &str) -> bool {
        let Some(entry) = self.entries.get(token) else {
            return false;
        };
        if Instant::now() >= entry.expires_at {
            drop(entry);
            self.entries.remove(token);
            return false;
        }
        // Atomic single-use: only the first CAS from false→true wins.
        entry
            .used
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
    }
}

// ---------------------------------------------------------------------------
// Shared running state (cloned into the protocol handler + dial commands)
// ---------------------------------------------------------------------------

struct Shared {
    endpoint: Endpoint,
    /// Live connections keyed by remote endpoint id (string).
    conns: DashMap<String, Connection>,
    /// Endpoint ids paired with this session — admitted on `Trusted` reconnect.
    trusted: DashSet<String>,
    tickets: PairingRegistry,
    events: Arc<EventBus>,
}

impl Shared {
    /// `secret` is the device identity. In production it comes from the OS
    /// keyring (`keystore::iroh_secret`) so the NodeId is stable across restarts;
    /// tests pass an ephemeral generated key to avoid touching the keyring.
    async fn start(
        events: Arc<EventBus>,
        use_relay: bool,
        secret: SecretKey,
    ) -> Result<Arc<Self>, String> {
        let endpoint = if use_relay {
            Endpoint::builder(N0)
                .secret_key(secret)
                .alpns(vec![SYNC_ALPN.to_vec()])
                .bind()
                .await
        } else {
            Endpoint::builder(N0DisableRelay)
                .secret_key(secret)
                .alpns(vec![SYNC_ALPN.to_vec()])
                .bind()
                .await
        }
        .map_err(|e| format!("iroh bind failed: {e}"))?;

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

    /// Address others can dial: the endpoint's own address (relay url under N0)
    /// plus loopback-rewritten direct sockets so two endpoints in one process
    /// (tests) can connect without any relay.
    fn dialable_addr(&self) -> EndpointAddr {
        let mut addr = self.endpoint.addr();
        for sock in self.endpoint.bound_sockets() {
            if let Some(loopback) = loopbackify(sock) {
                addr.addrs.insert(TransportAddr::Ip(loopback));
            }
            addr.addrs.insert(TransportAddr::Ip(sock));
        }
        addr
    }

    fn mint_ticket(&self, ttl_seconds: u32) -> Result<PairingTicketDto, String> {
        let ttl = Duration::from_secs(ttl_seconds.max(1) as u64)
            .min(Duration::from_secs(TICKET_TTL_SECONDS));
        // Pre-shared key: never leaves this device. Only BLAKE3(psk) is public
        // (in the QR), where it channel-binds the human-verified fingerprint.
        let psk: [u8; 32] = rand::random();
        let psk_hash = blake3::hash(&psk);
        let token = hex::encode(rand::random::<[u8; 16]>());

        self.tickets.mint(token.clone(), ttl);

        let dial = DialTicket {
            addr: self.dialable_addr(),
            token,
        };
        let ticket = serde_json::to_string(&dial).map_err(|e| format!("ticket encode: {e}"))?;
        let expires_at = now_ms() + ttl.as_millis() as u64;

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
        let auth = AuthFrame::Pair { token: dial.token };
        self.dial(dial.addr, auth).await
    }

    async fn dial_trusted(self: &Arc<Self>, node_id: &str) -> Result<String, String> {
        let id = EndpointId::from_str(node_id).map_err(|e| format!("bad node id: {e}"))?;
        self.dial(EndpointAddr::from(id), AuthFrame::Trusted).await
    }

    /// Outbound connection + auth handshake. Used by both pairing and reconnect.
    async fn dial(self: &Arc<Self>, addr: EndpointAddr, auth: AuthFrame) -> Result<String, String> {
        let conn = self
            .endpoint
            .connect(addr, SYNC_ALPN)
            .await
            .map_err(|e| format!("connect failed: {e}"))?;
        let peer_id = conn.remote_id().to_string();

        // Auth stream: send the frame, then read a 1-byte verdict.
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

        // Authorized: we now trust the dialed peer for this session.
        self.trusted.insert(peer_id.clone());
        self.register_and_pump(peer_id.clone(), conn, true);
        Ok(peer_id)
    }

    /// Register a live connection, emit `connected`, and start the receive loop.
    /// When `spawn` is true the receive loop runs on its own task (dial side);
    /// otherwise the caller drives it (accept side keeps the conn alive).
    fn register_and_pump(self: &Arc<Self>, peer_id: String, conn: Connection, spawn: bool) {
        self.conns.insert(peer_id.clone(), conn.clone());
        self.events
            .emit(TransportEvent::PeerStatus(PeerStatusDto::Connected {
                peer_id: peer_id.clone(),
            }));
        if spawn {
            // `tokio::spawn` (not `tauri::async_runtime::spawn`) so the receive
            // loop shares the runtime that drives the iroh endpoint — true in
            // both a Tauri async command and a `#[tokio::test]`.
            let shared = self.clone();
            tokio::spawn(async move {
                shared.recv_loop(peer_id, conn).await;
            });
        }
    }

    /// Read one sync message per inbound bidirectional stream until the peer
    /// disconnects.
    async fn recv_loop(self: Arc<Self>, peer_id: String, conn: Connection) {
        // Loop ends when `accept_bi` errors — the connection was closed / lost.
        while let Ok((_send, mut recv)) = conn.accept_bi().await {
            match recv.read_to_end(MAX_MSG_BYTES).await {
                Ok(payload) => self.events.emit(TransportEvent::Message {
                    peer_id: peer_id.clone(),
                    payload,
                }),
                Err(e) => eprintln!("[iroh] read message failed: {e}"),
            }
        }
        self.conns.remove(&peer_id);
        self.events
            .emit(TransportEvent::PeerStatus(PeerStatusDto::Disconnected {
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
            self.events
                .emit(TransportEvent::PeerStatus(PeerStatusDto::Disconnected {
                    peer_id: peer_id.to_string(),
                }));
        }
    }
}

/// Map an unspecified bind address (0.0.0.0 / [::]) to loopback so a peer in
/// the same process can reach it. Returns `None` when already specific.
fn loopbackify(sock: SocketAddr) -> Option<SocketAddr> {
    if sock.ip().is_unspecified() {
        Some(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            sock.port(),
        ))
    } else {
        None
    }
}

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Protocol handler (accept side)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
struct SyncProtocol {
    shared: Arc<Shared>,
}

impl std::fmt::Debug for Shared {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Shared").finish_non_exhaustive()
    }
}

impl ProtocolHandler for SyncProtocol {
    async fn accept(&self, conn: Connection) -> Result<(), AcceptError> {
        let peer_id = conn.remote_id().to_string();

        // Auth handshake: read the dialer's frame off the first stream.
        let (mut send, mut recv) = conn.accept_bi().await?;
        let raw = recv
            .read_to_end(MAX_AUTH_BYTES)
            .await
            .map_err(AcceptError::from_err)?;
        let authorized = match serde_json::from_slice::<AuthFrame>(&raw) {
            Ok(AuthFrame::Pair { token }) => {
                let ok = self.shared.tickets.consume(&token);
                if ok {
                    // Pairing succeeded → trust this peer for the session.
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

        // Authorized: register + drive the receive loop inline so the spawned
        // accept task keeps the connection alive.
        self.shared
            .register_and_pump(peer_id.clone(), conn.clone(), false);
        self.shared.clone().recv_loop(peer_id, conn).await;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tauri-managed state + commands (1:1 with the TS TransportAdapter)
// ---------------------------------------------------------------------------

#[derive(Default)]
struct RunningSlot(Mutex<Option<Running>>);

struct Running {
    shared: Arc<Shared>,
    router: Router,
}

pub struct IrohState {
    events: Arc<EventBus>,
    running: RunningSlot,
}

impl Default for IrohState {
    fn default() -> Self {
        Self {
            events: Arc::new(EventBus::new()),
            running: RunningSlot::default(),
        }
    }
}

impl IrohState {
    async fn shared(&self) -> Result<Arc<Shared>, String> {
        self.running
            .0
            .lock()
            .await
            .as_ref()
            .map(|r| r.shared.clone())
            .ok_or_else(|| "iroh not started".to_string())
    }
}

#[tauri::command]
pub async fn iroh_start(state: State<'_, IrohState>) -> Result<String, String> {
    let mut slot = state.running.0.lock().await;
    if let Some(r) = slot.as_ref() {
        return Ok(r.shared.node_id());
    }
    // Durable device identity: load (or first-run generate) the iroh secret from
    // the OS keyring so this device keeps the same NodeId across restarts.
    let secret = SecretKey::from_bytes(&crate::keystore::iroh_secret()?);
    let shared = Shared::start(state.events.clone(), true, secret).await?;
    let proto = SyncProtocol {
        shared: shared.clone(),
    };
    let router = Router::builder(shared.endpoint.clone())
        .accept(SYNC_ALPN, proto)
        .spawn();
    let node_id = shared.node_id();
    *slot = Some(Running { shared, router });
    Ok(node_id)
}

#[tauri::command]
pub async fn iroh_stop(state: State<'_, IrohState>) -> Result<(), String> {
    if let Some(running) = state.running.0.lock().await.take() {
        running.router.shutdown().await.ok();
        running.shared.endpoint.close().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn iroh_mint_pairing_ticket(
    state: State<'_, IrohState>,
    ttl_seconds: u32,
) -> Result<PairingTicketDto, String> {
    state.shared().await?.mint_ticket(ttl_seconds)
}

#[tauri::command]
pub async fn iroh_dial_with_ticket(
    state: State<'_, IrohState>,
    ticket: String,
) -> Result<String, String> {
    state.shared().await?.dial_with_ticket(&ticket).await
}

#[tauri::command]
pub async fn iroh_dial_trusted(
    state: State<'_, IrohState>,
    node_id: String,
) -> Result<String, String> {
    state.shared().await?.dial_trusted(&node_id).await
}

#[tauri::command]
pub async fn iroh_send(
    state: State<'_, IrohState>,
    peer_id: String,
    payload: Vec<u8>,
) -> Result<(), String> {
    state.shared().await?.send(&peer_id, &payload).await
}

#[tauri::command]
pub async fn iroh_close_peer(state: State<'_, IrohState>, peer_id: String) -> Result<(), String> {
    state.shared().await?.close_peer(&peer_id);
    Ok(())
}

#[tauri::command]
pub async fn iroh_subscribe(
    state: State<'_, IrohState>,
    channel: Channel<TransportEvent>,
) -> Result<(), String> {
    state.events.attach(channel);
    Ok(())
}

#[cfg(test)]
mod tests;
