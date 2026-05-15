import type {
  TransportAdapter,
  PairingTicket,
  PeerConnection,
  PeerStatusEvent,
  Unsubscribe,
} from '@todo-p2p/core/adapters';

/**
 * Placeholder transport: no peers, no network. Used while iroh-js WASM wiring
 * is still TODO. The SyncEngine uses it to keep the persistence path symmetric
 * (snapshot + change log) without surfacing transient sync errors to the UI.
 */
export class NullTransport implements TransportAdapter {
  async start(): Promise<string> {
    return 'null-node';
  }
  async stop(): Promise<void> {}
  async mintPairingTicket(): Promise<PairingTicket> {
    throw new Error('pairing unavailable — transport not yet wired');
  }
  async dialWithTicket(): Promise<PeerConnection> {
    throw new Error('pairing unavailable — transport not yet wired');
  }
  async dialTrusted(): Promise<PeerConnection> {
    throw new Error('pairing unavailable — transport not yet wired');
  }
  onMessage(): Unsubscribe {
    return () => {};
  }
  onPeerStatus(_: (e: PeerStatusEvent) => void): Unsubscribe {
    return () => {};
  }
}
