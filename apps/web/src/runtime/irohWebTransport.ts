import type {
  TransportAdapter,
  PairingTicket,
  PeerConnection,
  PeerStatusEvent,
  Unsubscribe,
} from '@todo-p2p/core/adapters';
import { TransportEventHub, makePeerConnection, type WireEvent } from './transportEventHub';

/** Shape of `iroh-wasm`'s `mintPairingTicket` result (camelCase via serde). */
interface TicketDto {
  ticket: string;
  nodeId: string;
  pskHash: number[];
  expiresAt: number;
}

type WorkerMessage =
  | { type: 'rpc-result'; id: number; ok: true; value: unknown }
  | { type: 'rpc-result'; id: number; ok: false; error: string }
  | { type: 'event'; event: WireEvent };

/**
 * Web `TransportAdapter`: runs iroh-js WASM in a Web Worker
 * (`irohWorker.ts`) and proxies every call over postMessage RPC. Browser iroh
 * is relay-only but still end-to-end encrypted.
 *
 * `open()` eagerly starts the node so a WASM/init failure surfaces here and the
 * runtime factory can fall back to `NullTransport` (CLAUDE.md: no silent
 * fallback to a weaker *transport* — a single-device app with no peers is not a
 * weaker transport, it is no transport).
 */
export class IrohWebTransport implements TransportAdapter {
  private readonly worker: Worker;
  private readonly hub = new TransportEventHub();
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
  private seq = 0;
  private nodeId: Promise<string> | null = null;

  private constructor() {
    this.worker = new Worker(new URL('./irohWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => this.onWorkerMessage(e.data);
  }

  static async open(): Promise<IrohWebTransport> {
    const t = new IrohWebTransport();
    t.nodeId = t.rpc<string>('start');
    await t.nodeId; // throws if the WASM module fails to initialize
    return t;
  }

  start(): Promise<string> {
    // open() already kicked off start; return the cached node id.
    return this.nodeId ?? (this.nodeId = this.rpc<string>('start'));
  }

  async stop(): Promise<void> {
    try {
      await this.rpc('stop');
    } finally {
      this.worker.terminate();
    }
  }

  async mintPairingTicket(ttlSeconds: number): Promise<PairingTicket> {
    const dto = await this.rpc<TicketDto>('mintPairingTicket', ttlSeconds);
    return {
      ticket: dto.ticket,
      nodeId: dto.nodeId,
      pskHash: Uint8Array.from(dto.pskHash),
      expiresAt: dto.expiresAt,
    };
  }

  async dialWithTicket(ticket: string): Promise<PeerConnection> {
    return this.peer(await this.rpc<string>('dialWithTicket', ticket));
  }

  async dialTrusted(nodeId: string): Promise<PeerConnection> {
    return this.peer(await this.rpc<string>('dialTrusted', nodeId));
  }

  connectionTo(peerId: string): PeerConnection {
    return this.peer(peerId);
  }

  onMessage(handler: (peerId: string, payload: Uint8Array) => void): Unsubscribe {
    return this.hub.onMessage(handler);
  }

  onPeerStatus(handler: (event: PeerStatusEvent) => void): Unsubscribe {
    return this.hub.onPeerStatus(handler);
  }

  private peer(peerId: string): PeerConnection {
    return makePeerConnection(
      peerId,
      (payload) => this.rpc<void>('send', peerId, payload),
      () => this.rpc<void>('closePeer', peerId),
    );
  }

  private rpc<T>(method: string, ...args: unknown[]): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ type: 'rpc', id, method, args });
    });
  }

  private onWorkerMessage(msg: WorkerMessage): void {
    if (msg.type === 'event') {
      this.hub.dispatch(msg.event);
      return;
    }
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.value);
    else p.reject(new Error(msg.error));
  }
}
