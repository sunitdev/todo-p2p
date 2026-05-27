import {
  decodePairingPayload,
  fingerprint,
  pairingReduce,
  TICKET_TTL_SECONDS,
  type PairingEvent,
  type PairingPayload,
  type PairingState,
  type SyncEngine,
} from '@todo-p2p/core';
import type {
  PeerConnection,
  StorageAdapter,
  TransportAdapter,
  Unsubscribe,
} from '@todo-p2p/core/adapters';

export interface PairingDeps {
  transport: TransportAdapter;
  storage: StorageAdapter;
  engine: SyncEngine;
  /** Called once a peer is paired, with its node id (App marks it trusted). */
  onPaired?: (nodeId: string) => void;
}

/**
 * Drives the pairing handshake: ties the pure FSM (`pairingReduce`) to the
 * transport. Security properties live in the FSM transitions and the transport
 * ticket gate; this orchestrates and surfaces state to the UI.
 *
 *   host():  mint ticket → show QR → await peer connect → await fingerprint OK
 *   scan():  decode QR → dial → await fingerprint OK
 *   confirm(): persist trusted peer + replay full state both ways → paired
 */
export class PairingController {
  private state: PairingState = { kind: 'idle' };
  private readonly listeners = new Set<(s: PairingState) => void>();
  private conn: PeerConnection | null = null;
  private remotePeerId: string | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private statusUnsub: Unsubscribe | null = null;

  constructor(private readonly deps: PairingDeps) {}

  getState(): PairingState {
    return this.state;
  }

  subscribe(cb: (s: PairingState) => void): Unsubscribe {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  /** Existing device: mint a single-use ticket and show its QR. */
  async host(): Promise<void> {
    this.cleanup();
    const ticket = await this.deps.transport.mintPairingTicket(TICKET_TTL_SECONDS);
    const pskHash = toHex(ticket.pskHash);
    const payload: PairingPayload = {
      v: 1,
      nodeId: ticket.nodeId,
      ticket: ticket.ticket,
      pskHash,
      fingerprint: fingerprint(ticket.nodeId, pskHash),
    };
    this.apply({ kind: 'ticket-minted', payload, expiresAt: ticket.expiresAt });
    this.expiryTimer = setTimeout(
      () => {
        if (this.state.kind === 'showing-ticket') this.apply({ kind: 'ticket-expired' });
      },
      Math.max(0, ticket.expiresAt - Date.now()),
    );
    // First peer to connect while we're showing the ticket is the joiner.
    this.statusUnsub = this.deps.transport.onPeerStatus((e) => {
      if (e.type === 'connected' && this.state.kind === 'showing-ticket') {
        this.remotePeerId = e.peerId;
        this.conn = this.deps.transport.connectionTo(e.peerId);
        this.apply({ kind: 'peer-handshake-complete', remotePeerId: e.peerId });
      }
    });
  }

  /** New device: decode a scanned QR payload and dial the host. */
  async scan(raw: string): Promise<void> {
    this.cleanup();
    let payload: PairingPayload;
    try {
      payload = decodePairingPayload(raw);
    } catch {
      this.apply({ kind: 'error', reason: 'invalid QR code' });
      return;
    }
    this.apply({ kind: 'ticket-scanned', payload });
    try {
      const conn = await this.deps.transport.dialWithTicket(payload.ticket);
      this.conn = conn;
      this.remotePeerId = conn.peerId;
      this.apply({ kind: 'peer-handshake-complete', remotePeerId: conn.peerId });
    } catch (e) {
      this.apply({ kind: 'error', reason: e instanceof Error ? e.message : String(e) });
    }
  }

  /** User confirmed the 6-word fingerprint matches: persist + full sync. */
  async confirm(): Promise<void> {
    if (this.state.kind !== 'awaiting-fingerprint-confirm' || !this.remotePeerId) return;
    const peerId = this.remotePeerId;
    this.apply({ kind: 'fingerprint-confirmed' }); // -> syncing
    try {
      await this.deps.storage.saveTrustedPeer({
        nodeId: peerId,
        // M1 identity is the iroh EndpointId string (iroh TLS authenticates it);
        // we keep its bytes for the record. Durable key material lands with M2.
        publicKey: new TextEncoder().encode(peerId),
        pairedAt: Date.now(),
        lastSeenAt: Date.now(),
      });
      this.deps.onPaired?.(peerId);
      const conn = this.conn ?? this.deps.transport.connectionTo(peerId);
      await this.deps.engine.initialSyncTo(conn);
      this.apply({ kind: 'sync-complete' }); // -> paired
    } catch (e) {
      this.apply({ kind: 'error', reason: e instanceof Error ? e.message : String(e) });
    }
  }

  /** User says the fingerprints differ — possible MITM. Abort. */
  reject(): void {
    this.apply({ kind: 'fingerprint-rejected' });
    void this.conn?.close();
    this.cleanup();
  }

  /** Return to idle (e.g. leaving the pairing screen). */
  reset(): void {
    this.cleanup();
    this.state = { kind: 'idle' };
    for (const l of this.listeners) l(this.state);
  }

  private apply(ev: PairingEvent): void {
    this.state = pairingReduce(this.state, ev);
    for (const l of this.listeners) l(this.state);
  }

  private cleanup(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    this.statusUnsub?.();
    this.statusUnsub = null;
  }
}

function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}
