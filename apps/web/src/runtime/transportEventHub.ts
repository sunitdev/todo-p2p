import type { PeerStatusEvent, Unsubscribe } from '@todo-p2p/core/adapters';

/**
 * Wire event shape emitted by both transports (desktop Tauri Channel + web WASM
 * worker). Field names are camelCase to match the Rust `#[serde(rename_all,
 * rename_all_fields = "camelCase")]` on `TransportEvent`. `payload` arrives as a
 * number array over JSON / serde-wasm-bindgen and is normalized to Uint8Array.
 */
export type WireEvent =
  | { type: 'message'; peerId: string; payload: number[] | Uint8Array }
  | {
      type: 'peerStatus';
      status: 'connected' | 'disconnected' | 'error';
      peerId: string;
      error?: string;
    };

/**
 * Shared fan-out for `onMessage` / `onPeerStatus`. Both transport
 * implementations own one and call `dispatch` with each wire event, so the
 * demux + Uint8Array normalization lives in exactly one place.
 */
export class TransportEventHub {
  private messageHandlers = new Set<(peerId: string, payload: Uint8Array) => void>();
  private statusHandlers = new Set<(event: PeerStatusEvent) => void>();

  onMessage(handler: (peerId: string, payload: Uint8Array) => void): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onPeerStatus(handler: (event: PeerStatusEvent) => void): Unsubscribe {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  dispatch(ev: WireEvent): void {
    if (ev.type === 'message') {
      const payload = ev.payload instanceof Uint8Array ? ev.payload : Uint8Array.from(ev.payload);
      for (const h of this.messageHandlers) h(ev.peerId, payload);
      return;
    }
    const event: PeerStatusEvent =
      ev.status === 'error'
        ? { type: 'error', peerId: ev.peerId, error: ev.error ?? 'unknown error' }
        : { type: ev.status, peerId: ev.peerId };
    for (const h of this.statusHandlers) h(event);
  }
}

/** Build the `PeerConnection` the SyncEngine sends over, backed by `send`/`close`. */
export function makePeerConnection(
  peerId: string,
  send: (payload: Uint8Array) => Promise<void>,
  close: () => Promise<void>,
): import('@todo-p2p/core/adapters').PeerConnection {
  return { peerId, send, close };
}
