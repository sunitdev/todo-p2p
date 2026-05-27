import type {
  TransportAdapter,
  PairingTicket,
  PeerConnection,
  PeerStatusEvent,
  Unsubscribe,
} from '@todo-p2p/core/adapters';
import { TransportEventHub, makePeerConnection, type WireEvent } from './transportEventHub';

interface TicketDto {
  ticket: string;
  nodeId: string;
  pskHash: number[];
  expiresAt: number;
}

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * Desktop `TransportAdapter`: iroh runs natively in Rust; this proxies to the
 * `iroh_*` Tauri commands. Incoming messages + peer-status arrive on a single
 * `iroh_subscribe` Channel and are demuxed by the shared hub. Tauri v2 converts
 * camelCase JS argument keys to the snake_case Rust parameters.
 */
export class IrohTauriTransport implements TransportAdapter {
  private readonly hub = new TransportEventHub();

  private constructor(private readonly invoke: Invoke) {}

  static async open(): Promise<IrohTauriTransport> {
    const core = await import('@tauri-apps/api/core');
    const t = new IrohTauriTransport(core.invoke as Invoke);
    // Subscribe before start so no connection/message events are missed.
    const channel = new core.Channel<WireEvent>();
    channel.onmessage = (ev) => t.hub.dispatch(ev);
    await core.invoke('iroh_subscribe', { channel });
    return t;
  }

  start(): Promise<string> {
    return this.invoke<string>('iroh_start');
  }

  async stop(): Promise<void> {
    await this.invoke('iroh_stop');
  }

  async mintPairingTicket(ttlSeconds: number): Promise<PairingTicket> {
    const dto = await this.invoke<TicketDto>('iroh_mint_pairing_ticket', { ttlSeconds });
    return {
      ticket: dto.ticket,
      nodeId: dto.nodeId,
      pskHash: Uint8Array.from(dto.pskHash),
      expiresAt: dto.expiresAt,
    };
  }

  async dialWithTicket(ticket: string): Promise<PeerConnection> {
    return this.peer(await this.invoke<string>('iroh_dial_with_ticket', { ticket }));
  }

  async dialTrusted(nodeId: string): Promise<PeerConnection> {
    return this.peer(await this.invoke<string>('iroh_dial_trusted', { nodeId }));
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
      // number[] serializes to Vec<u8> reliably over the JSON IPC.
      (payload) => this.invoke<void>('iroh_send', { peerId, payload: Array.from(payload) }),
      () => this.invoke<void>('iroh_close_peer', { peerId }),
    );
  }
}
