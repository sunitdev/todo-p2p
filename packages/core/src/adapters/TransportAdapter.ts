/**
 * Bidirectional p2p transport. Implementations wrap iroh:
 *   - desktop: iroh crate via Tauri commands
 *   - mobile:  iroh-ffi via Expo Module
 *   - web:     iroh-js WASM in a Web Worker
 *
 * Sync payloads are opaque Uint8Array (Automerge sync messages); the transport
 * is responsible for E2EE on the wire (iroh QUIC + Noise handles this).
 */
export interface TransportAdapter {
  /** Start the local node. Resolves with this device's iroh NodeId. */
  start(): Promise<string>;
  stop(): Promise<void>;

  /** Mint a single-use pairing ticket valid for `ttlSeconds`. */
  mintPairingTicket(ttlSeconds: number): Promise<PairingTicket>;
  /** Dial a peer using a ticket scanned from QR. */
  dialWithTicket(ticket: string): Promise<PeerConnection>;
  /** Reconnect to a previously trusted peer. */
  dialTrusted(nodeId: string): Promise<PeerConnection>;

  /**
   * Sendable handle to an already-connected peer (by id). Used to talk back to
   * peers that dialed *us* — those arrive via `onPeerStatus` "connected" with no
   * dial result. Does not open a connection; `send` fails if the peer is gone.
   */
  connectionTo(peerId: string): PeerConnection;

  /** Subscribe to incoming sync messages from any connected peer. */
  onMessage(handler: (peerId: string, payload: Uint8Array) => void): Unsubscribe;
  /** Subscribe to peer connection lifecycle. */
  onPeerStatus(handler: (event: PeerStatusEvent) => void): Unsubscribe;
}

export interface PairingTicket {
  ticket: string;
  nodeId: string;
  pskHash: Uint8Array;
  expiresAt: number;
}

export interface PeerConnection {
  peerId: string;
  send(payload: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export type PeerStatusEvent =
  | { type: "connected"; peerId: string }
  | { type: "disconnected"; peerId: string }
  | { type: "error"; peerId: string; error: string };

export type Unsubscribe = () => void;
