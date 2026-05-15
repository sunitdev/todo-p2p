import type {
  PairingTicket,
  PeerConnection,
  PeerStatusEvent,
  TransportAdapter,
  Unsubscribe,
} from "../../src/adapters/index.ts";

type MessageHandler = (peerId: string, payload: Uint8Array) => void;

/** In-memory TransportAdapter for tests. `inject` simulates incoming peer messages. */
export class MemTransport implements TransportAdapter {
  private handlers = new Set<MessageHandler>();
  private statusHandlers = new Set<(e: PeerStatusEvent) => void>();
  stopped = false;

  async start() {
    return "node-mock";
  }
  async stop() {
    this.stopped = true;
  }
  async mintPairingTicket(ttlSeconds: number): Promise<PairingTicket> {
    return {
      ticket: "t",
      nodeId: "node-mock",
      pskHash: new Uint8Array(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
  }
  async dialWithTicket(): Promise<PeerConnection> {
    throw new Error("not used");
  }
  async dialTrusted(): Promise<PeerConnection> {
    throw new Error("not used");
  }
  onMessage(h: MessageHandler): Unsubscribe {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  onPeerStatus(h: (e: PeerStatusEvent) => void): Unsubscribe {
    this.statusHandlers.add(h);
    return () => this.statusHandlers.delete(h);
  }
  inject(peerId: string, payload: Uint8Array) {
    for (const h of this.handlers) h(peerId, payload);
  }
}

/** Stub PeerConnection that records sends; optionally fails on next send. */
export class FakePeer {
  peerId: string;
  sent: Uint8Array[] = [];
  failNext: Error | null = null;
  constructor(peerId = "peer-1") {
    this.peerId = peerId;
  }
  async send(p: Uint8Array): Promise<void> {
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
    this.sent.push(p);
  }
}
