import { Backoff } from '@todo-p2p/core';
import type {
  PeerConnection,
  PeerStatusEvent,
  StorageAdapter,
  TransportAdapter,
  Unsubscribe,
} from '@todo-p2p/core/adapters';

/** Connection state for a trusted peer, surfaced to the UI (M4 E4.3). */
export type PeerConnState = 'connected' | 'reconnecting' | 'disconnected';

export interface PeerStatusChange {
  peerId: string;
  state: PeerConnState;
}

/**
 * Injectable timer + randomness so reconnect backoff is deterministic in tests
 * (no real waiting, no `Math.random`). Production uses the real globals.
 */
export interface PeerManagerClock {
  setTimeout(cb: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  rng(): number;
}

const defaultClock: PeerManagerClock = {
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  rng: Math.random,
};

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
 *
 * M4 E4.3: a dropped trusted peer is re-dialed immediately; if that dial fails
 * the peer is retried on an exponential backoff (per-peer `Backoff`) until it
 * answers, an inbound connection arrives, or we stop. `onStatus` exposes the
 * connected/reconnecting/disconnected transitions so the UI can reflect reality.
 */
export class PeerManager {
  private readonly live = new Map<string, PeerConnection>();
  /** Node ids we should keep reconnecting to (paired this session or loaded). */
  private readonly trusted = new Set<string>();
  private readonly reconnecting = new Set<string>();
  private readonly backoffs = new Map<string, Backoff>();
  private readonly timers = new Map<string, unknown>();
  private readonly countListeners = new Set<(count: number) => void>();
  private readonly statusListeners = new Set<(e: PeerStatusChange) => void>();
  private unsub: Unsubscribe | null = null;
  private stopped = false;

  constructor(
    private readonly transport: TransportAdapter,
    private readonly storage: StorageAdapter,
    private readonly clock: PeerManagerClock = defaultClock,
  ) {}

  /** Start the node, then reconnect to every persisted trusted peer. */
  async start(): Promise<string> {
    this.unsub = this.transport.onPeerStatus((e) => this.onTransportStatus(e));
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

  /**
   * Subscribe to per-peer connection-state transitions (M4 E4.3) so the UI can
   * show "connected"/"reconnecting" instead of only a count. Returns unsubscribe.
   */
  onStatus(cb: (e: PeerStatusChange) => void): Unsubscribe {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  private emitCount(): void {
    const n = this.live.size;
    for (const cb of this.countListeners) cb(n);
  }

  private emitStatus(peerId: string, state: PeerConnState): void {
    for (const cb of this.statusListeners) cb({ peerId, state });
  }

  /** Mark a freshly paired peer trusted so it reconnects after a drop. */
  trust(nodeId: string): void {
    this.trusted.add(nodeId);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.unsub?.();
    this.unsub = null;
    for (const h of this.timers.values()) this.clock.clearTimeout(h);
    this.timers.clear();
    this.live.clear();
  }

  private onTransportStatus(e: PeerStatusEvent): void {
    if (e.type === 'connected') {
      this.live.set(e.peerId, this.transport.connectionTo(e.peerId));
      this.clearRetry(e.peerId);
      this.backoffFor(e.peerId).reset();
      this.emitCount();
      this.emitStatus(e.peerId, 'connected');
      return;
    }
    // disconnected | error
    this.live.delete(e.peerId);
    this.emitCount();
    if (!this.stopped && this.trusted.has(e.peerId)) {
      this.emitStatus(e.peerId, 'reconnecting');
      void this.reconnect(e.peerId);
    } else {
      this.emitStatus(e.peerId, 'disconnected');
    }
  }

  private async reconnect(nodeId: string): Promise<void> {
    if (this.stopped || this.live.has(nodeId) || this.reconnecting.has(nodeId)) return;
    this.reconnecting.add(nodeId);
    try {
      const conn = await this.transport.dialTrusted(nodeId);
      // Defense in depth: the dialed id must be the one that answered.
      if (conn.peerId === nodeId) {
        this.live.set(conn.peerId, conn);
        this.clearRetry(nodeId);
        this.backoffFor(nodeId).reset();
        this.emitCount();
        this.emitStatus(nodeId, 'connected');
      } else {
        await conn.close();
        this.scheduleRetry(nodeId);
      }
    } catch {
      // Peer offline / dial failed — back off and try again later.
      this.scheduleRetry(nodeId);
    } finally {
      this.reconnecting.delete(nodeId);
    }
  }

  /** Arm a backed-off retry for a still-trusted, still-offline peer. */
  private scheduleRetry(nodeId: string): void {
    if (this.stopped || !this.trusted.has(nodeId) || this.live.has(nodeId)) return;
    this.clearRetry(nodeId);
    const delay = this.backoffFor(nodeId).nextDelay();
    const handle = this.clock.setTimeout(() => {
      this.timers.delete(nodeId);
      void this.reconnect(nodeId);
    }, delay);
    this.timers.set(nodeId, handle);
    this.emitStatus(nodeId, 'reconnecting');
  }

  private clearRetry(nodeId: string): void {
    const h = this.timers.get(nodeId);
    if (h !== undefined) {
      this.clock.clearTimeout(h);
      this.timers.delete(nodeId);
    }
  }

  private backoffFor(nodeId: string): Backoff {
    let b = this.backoffs.get(nodeId);
    if (!b) {
      // ±20% jitter so re-paired peers don't reconnect in lockstep.
      b = new Backoff({ jitter: 0.2, rng: () => this.clock.rng() });
      this.backoffs.set(nodeId, b);
    }
    return b;
  }
}
