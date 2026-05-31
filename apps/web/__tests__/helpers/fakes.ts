import type {
  PairingTicket,
  PeerConnection,
  PeerStatusEvent,
  StorageAdapter,
  TransportAdapter,
  TrustedPeer,
  Unsubscribe,
} from '@todo-p2p/core/adapters';

/** Programmable in-memory TransportAdapter for runtime unit tests. */
export class FakeTransport implements TransportAdapter {
  started = false;
  minted: PairingTicket[] = [];
  dialedTickets: string[] = [];
  dialedTrusted: string[] = [];
  sent: Array<{ peerId: string; payload: Uint8Array }> = [];
  closed: string[] = [];
  mintExpiresInMs = 60_000;

  /** Override to control dial outcomes (peer id / rejection). */
  dialWithTicketImpl?: (ticket: string) => Promise<PeerConnection>;
  dialTrustedImpl?: (nodeId: string) => Promise<PeerConnection>;

  private statusHandlers = new Set<(e: PeerStatusEvent) => void>();
  private msgHandlers = new Set<(peerId: string, payload: Uint8Array) => void>();

  async start(): Promise<string> {
    this.started = true;
    return 'self-node';
  }
  async stop(): Promise<void> {}

  async mintPairingTicket(ttlSeconds: number): Promise<PairingTicket> {
    const ticket: PairingTicket = {
      ticket: 'TICKET',
      nodeId: 'self-node',
      pskHash: new Uint8Array([0xab, 0xcd, 0xef]),
      expiresAt: Date.now() + Math.min(this.mintExpiresInMs, ttlSeconds * 1000),
    };
    this.minted.push(ticket);
    return ticket;
  }

  async dialWithTicket(ticket: string): Promise<PeerConnection> {
    this.dialedTickets.push(ticket);
    return this.dialWithTicketImpl ? this.dialWithTicketImpl(ticket) : this.connectionTo('peer-host');
  }

  async dialTrusted(nodeId: string): Promise<PeerConnection> {
    this.dialedTrusted.push(nodeId);
    return this.dialTrustedImpl ? this.dialTrustedImpl(nodeId) : this.connectionTo(nodeId);
  }

  connectionTo(peerId: string): PeerConnection {
    return {
      peerId,
      send: async (payload) => {
        this.sent.push({ peerId, payload });
      },
      close: async () => {
        this.closed.push(peerId);
      },
    };
  }

  onMessage(h: (peerId: string, payload: Uint8Array) => void): Unsubscribe {
    this.msgHandlers.add(h);
    return () => this.msgHandlers.delete(h);
  }
  onPeerStatus(h: (e: PeerStatusEvent) => void): Unsubscribe {
    this.statusHandlers.add(h);
    return () => this.statusHandlers.delete(h);
  }

  // --- test drivers ---
  emitStatus(e: PeerStatusEvent): void {
    for (const h of this.statusHandlers) h(e);
  }
  emitMessage(peerId: string, payload: Uint8Array): void {
    for (const h of this.msgHandlers) h(peerId, payload);
  }
}

/** Minimal in-memory StorageAdapter; only the parts the runtime touches. */
export class FakeStorage implements StorageAdapter {
  trusted: TrustedPeer[] = [];
  saved: TrustedPeer[] = [];

  async loadDoc(): Promise<Uint8Array | null> {
    return null;
  }
  async saveDoc(): Promise<void> {}
  async appendChange(): Promise<void> {}
  async loadChanges(): Promise<Uint8Array[]> {
    return [];
  }
  async truncateChanges(): Promise<void> {}
  async loadTrustedPeers(): Promise<TrustedPeer[]> {
    return [...this.trusted];
  }
  async saveTrustedPeer(peer: TrustedPeer): Promise<void> {
    this.saved.push(peer);
    this.trusted = this.trusted.filter((p) => p.nodeId !== peer.nodeId);
    this.trusted.push(peer);
  }
  async removeTrustedPeer(nodeId: string): Promise<void> {
    this.trusted = this.trusted.filter((p) => p.nodeId !== nodeId);
  }
  async wipe(): Promise<void> {
    this.trusted = [];
    this.saved = [];
  }
}

export const tick = () => new Promise((r) => setTimeout(r, 0));
