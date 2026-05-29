//! Two-endpoint integration tests for the iroh transport.
//!
//! Each test binds two real iroh endpoints in one process with the relay
//! disabled and connects over loopback — no network, no relay, CI-safe. They
//! cover the M1 acceptance cases: pairing + bidirectional sync, ticket expiry,
//! single-use, bad-ticket rejection, and trusted-reconnect auth gating.
//!
//! Production `dial_trusted(node_id)` resolves a bare id via the N0 relay +
//! discovery; that address resolution is exercised by manual verification (two
//! machines). Here we drive the same `Trusted` auth path with a resolvable
//! loopback address so the *authorization* logic is covered deterministically.

use super::*;
use std::time::Duration;
use tokio::sync::broadcast::Receiver;
use tokio::time::timeout;

struct Node {
    shared: Arc<Shared>,
    // Held to keep the accept loop alive for the test's duration.
    _router: Router,
}

async fn start_node() -> Node {
    let events = Arc::new(EventBus::new());
    let shared = Shared::start(events, /* use_relay */ false, SecretKey::generate())
        .await
        .expect("endpoint binds");
    let router = Router::builder(shared.endpoint.clone())
        .accept(
            SYNC_ALPN,
            SyncProtocol {
                shared: shared.clone(),
            },
        )
        .spawn();
    Node {
        shared,
        _router: router,
    }
}

async fn next_message(rx: &mut Receiver<TransportEvent>) -> Option<(String, Vec<u8>)> {
    loop {
        match timeout(Duration::from_secs(10), rx.recv()).await {
            Ok(Ok(TransportEvent::Message { peer_id, payload })) => {
                return Some((peer_id, payload))
            }
            Ok(Ok(_)) => continue,
            _ => return None,
        }
    }
}

async fn next_connected(rx: &mut Receiver<TransportEvent>) -> Option<String> {
    loop {
        match timeout(Duration::from_secs(10), rx.recv()).await {
            Ok(Ok(TransportEvent::PeerStatus(PeerStatusDto::Connected { peer_id }))) => {
                return Some(peer_id)
            }
            Ok(Ok(_)) => continue,
            _ => return None,
        }
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn pair_and_sync_bidirectional() {
    let host = start_node().await;
    let joiner = start_node().await;
    let host_id = host.shared.node_id();
    let joiner_id = joiner.shared.node_id();

    let mut host_events = host.shared.events.subscribe();
    let mut joiner_events = joiner.shared.events.subscribe();

    let ticket = host.shared.mint_ticket(60).expect("mint");
    let dialed = joiner
        .shared
        .dial_with_ticket(&ticket.ticket)
        .await
        .expect("pairing succeeds");
    assert_eq!(dialed, host_id, "dialer learns the host endpoint id");

    // Both sides observe the connection.
    assert_eq!(
        next_connected(&mut host_events).await.as_deref(),
        Some(joiner_id.as_str())
    );
    assert_eq!(
        next_connected(&mut joiner_events).await.as_deref(),
        Some(host_id.as_str())
    );

    // joiner -> host
    joiner
        .shared
        .send(&host_id, b"hello-host")
        .await
        .expect("send up");
    let (from, payload) = next_message(&mut host_events).await.expect("host receives");
    assert_eq!(from, joiner_id);
    assert_eq!(payload, b"hello-host");

    // host -> joiner
    host.shared
        .send(&joiner_id, b"hello-joiner")
        .await
        .expect("send down");
    let (from, payload) = next_message(&mut joiner_events)
        .await
        .expect("joiner receives");
    assert_eq!(from, host_id);
    assert_eq!(payload, b"hello-joiner");
}

#[tokio::test(flavor = "multi_thread")]
async fn ticket_is_single_use() {
    let host = start_node().await;
    let j1 = start_node().await;
    let j2 = start_node().await;

    let ticket = host.shared.mint_ticket(60).expect("mint");
    j1.shared
        .dial_with_ticket(&ticket.ticket)
        .await
        .expect("first pairing wins");
    let second = j2.shared.dial_with_ticket(&ticket.ticket).await;
    assert!(second.is_err(), "a spent ticket is rejected: {second:?}");
}

#[tokio::test(flavor = "multi_thread")]
async fn bad_ticket_is_rejected() {
    let host = start_node().await;
    let joiner = start_node().await;

    // Genuine host address, but a token that was never minted.
    let forged = DialTicket {
        addr: host.shared.dialable_addr(),
        token: "deadbeefdeadbeefdeadbeefdeadbeef".to_string(),
    };
    let raw = serde_json::to_string(&forged).unwrap();
    let result = joiner.shared.dial_with_ticket(&raw).await;
    assert!(result.is_err(), "unknown token is rejected: {result:?}");
}

#[tokio::test(flavor = "multi_thread")]
async fn trusted_reconnect_auth_gating() {
    let host = start_node().await;
    let joiner = start_node().await;
    let stranger = start_node().await;

    // Pair: host now trusts joiner (and vice versa) for this session.
    let ticket = host.shared.mint_ticket(60).expect("mint");
    joiner
        .shared
        .dial_with_ticket(&ticket.ticket)
        .await
        .expect("pair");

    // Trusted peer reconnects on a fresh connection → admitted.
    let reconnect = joiner
        .shared
        .dial(host.shared.dialable_addr(), AuthFrame::Trusted)
        .await;
    assert!(reconnect.is_ok(), "trusted peer reconnects: {reconnect:?}");

    // A stranger presenting Trusted (valid TLS identity, never paired) → rejected.
    let intruder = stranger
        .shared
        .dial(host.shared.dialable_addr(), AuthFrame::Trusted)
        .await;
    assert!(intruder.is_err(), "untrusted id is rejected: {intruder:?}");
}

#[test]
fn registry_enforces_single_use_and_expiry() {
    let reg = PairingRegistry::default();

    reg.mint("live".to_string(), Duration::from_secs(60));
    assert!(reg.consume("live"), "first use of a live ticket succeeds");
    assert!(!reg.consume("live"), "second use is rejected (single-use)");

    reg.mint("expired".to_string(), Duration::ZERO);
    assert!(!reg.consume("expired"), "an expired ticket is rejected");

    assert!(!reg.consume("never-minted"), "unknown token is rejected");
}
