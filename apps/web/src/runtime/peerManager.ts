import type {
  PeerConnection,
  PeerStatusEvent,
  StorageAdapter,
  TransportAdapter,
  Unsubscribe,
} from '@todo-p2p/core/adapters';

/**
 * Owns live peer connections — the wiring `SyncEngine` deliberately does not do
 * (it only consumes `onMessage`). `peers()` feeds `engine.commit(change,
 * peers())` so local edits broadcast; `onPeerStatus` keeps the set current and
 * re-dials trusted peers that drop.
 *
 * `connectionTo` lets us hold a send-handle for peers that dialed *us* (inbound,
 * no dial result). Identity is the iroh `EndpointId`: an outbound `dialTrusted`
 * only completes the TLS handshake to that exact id, and inbound connections are
 * gated by the transport (valid ticket, or already trusted) — so every id in
 * `live` is authorized.
 */
export class PeerManager {
  private readonly live = new Map<string, PeerConnection>();
  /** Node ids we should keep reconnecting to (paired this session or loaded). */
  private readonly trusted = new Set<string>();
  private readonly reconnecting = new Set<string>();
  private readonly countListeners = new Set<(count: number) => void>();
  private unsub: Unsubscribe | null = null;
  private stopped = false;

  constructor(
    private readonly transport: TransportAdapter,
    private readonly storage: StorageAdapter,
  ) {}

  /** Start the node, then reconnect to every persisted trusted peer. */
  async start(): Promise<string> {
    this.unsub = this.transport.onPeerStatus((e) => this.onStatus(e));
    const nodeId = await this.transport.start();
    for (const peer of await this.storage.loadTrustedPeers()) {
      this.trusted.add(peer.nodeId);
      void this.reconnect(peer.nodeId);
    }
    return nodeId;
  }

  /** Live connections to pass to `engine.commit`. */
  peers(): PeerConnection[] {
    return [...this.live.values()];
  }

  /** Count of currently connected peers (for Settings P9.7). */
  count(): number {
    return this.live.size;
  }

  /**
   * Subscribe to live connected-peer-count changes (Settings P9.7). Fires on
   * every connect/disconnect/reconnect so the UI reflects reality, not a stale
   * render-time snapshot. Returns an unsubscribe.
   */
  onChange(cb: (count: number) => void): Unsubscribe {
    this.countListeners.add(cb);
    return () => this.countListeners.delete(cb);
  }

  private emitCount(): void {
    const n = this.live.size;
    for (const cb of this.countListeners) cb(n);
  }

  /** Mark a freshly paired peer trusted so it reconnects after a drop. */
  trust(nodeId: string): void {
    this.trusted.add(nodeId);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.unsub?.();
    this.unsub = null;
    this.live.clear();
  }

  private onStatus(e: PeerStatusEvent): void {
    if (e.type === 'connected') {
      this.live.set(e.peerId, this.transport.connectionTo(e.peerId));
      this.emitCount();
      return;
    }
    // disconnected | error
    this.live.delete(e.peerId);
    this.emitCount();
    if (!this.stopped && this.trusted.has(e.peerId)) void this.reconnect(e.peerId);
  }

  private async reconnect(nodeId: string): Promise<void> {
    if (this.stopped || this.live.has(nodeId) || this.reconnecting.has(nodeId)) return;
    this.reconnecting.add(nodeId);
    try {
      const conn = await this.transport.dialTrusted(nodeId);
      // Defense in depth: the dialed id must be the one that answered.
      if (conn.peerId === nodeId) {
        this.live.set(conn.peerId, conn);
        this.emitCount();
      } else await conn.close();
    } catch {
      // Peer offline. A future inbound connection or M4's backoff retries.
    } finally {
      this.reconnecting.delete(nodeId);
    }
  }
}
