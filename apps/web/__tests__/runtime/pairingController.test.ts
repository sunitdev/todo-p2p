import { describe, expect, test, mock } from 'bun:test';
import { encodePairingPayload, fingerprint, type PairingState, type SyncEngine } from '@todo-p2p/core';
import { PairingController } from '../../src/runtime/pairingController';
import { FakeStorage, FakeTransport, tick } from '../helpers/fakes';

function fakeEngine(): { engine: SyncEngine; synced: Array<{ send: unknown }> } {
  const synced: Array<{ send: unknown }> = [];
  const engine = {
    async initialSyncTo(peer: { send: unknown }) {
      synced.push(peer);
    },
  } as unknown as SyncEngine;
  return { engine, synced };
}

function setup() {
  const transport = new FakeTransport();
  const storage = new FakeStorage();
  const { engine, synced } = fakeEngine();
  const onPaired = mock();
  const controller = new PairingController({ transport, storage, engine, onPaired });
  const states: PairingState[] = [];
  controller.subscribe((s) => states.push(s));
  return { transport, storage, controller, states, synced, onPaired };
}

describe('PairingController — host path', () => {
  test('host mints a ticket and shows it with a fingerprint', async () => {
    const { controller } = setup();
    await controller.host();
    const s = controller.getState();
    expect(s.kind).toBe('showing-ticket');
    if (s.kind !== 'showing-ticket') throw new Error('unreachable');
    expect(s.payload.nodeId).toBe('self-node');
    expect(s.payload.ticket).toBe('TICKET');
    expect(s.payload.fingerprint.split(' ')).toHaveLength(6);
  });

  test('peer connecting moves to fingerprint confirm, then confirm pairs + syncs', async () => {
    const { transport, storage, controller, synced, onPaired } = setup();
    await controller.host();
    transport.emitStatus({ type: 'connected', peerId: 'peer-host' });
    expect(controller.getState().kind).toBe('awaiting-fingerprint-confirm');

    await controller.confirm();

    expect(controller.getState().kind).toBe('paired');
    expect(storage.saved).toHaveLength(1);
    expect(storage.saved[0]?.nodeId).toBe('peer-host');
    expect(synced).toHaveLength(1); // initial full-state sync sent
    expect(onPaired).toHaveBeenCalledWith('peer-host');
  });
});

describe('PairingController — scan path', () => {
  test('scanning a valid payload dials the host', async () => {
    const { transport, controller } = setup();
    const raw = encodePairingPayload({
      v: 1,
      nodeId: 'host-node',
      ticket: 'SCAN_TICKET',
      pskHash: 'aabb',
      fingerprint: fingerprint('host-node', 'aabb'),
    });
    await controller.scan(raw);
    expect(transport.dialedTickets).toEqual(['SCAN_TICKET']);
    const s = controller.getState();
    expect(s.kind).toBe('awaiting-fingerprint-confirm');
    if (s.kind === 'awaiting-fingerprint-confirm') expect(s.remotePeerId).toBe('peer-host');
  });

  test('invalid QR moves to failed', async () => {
    const { controller } = setup();
    await controller.scan('not-json');
    const s = controller.getState();
    expect(s.kind).toBe('failed');
    if (s.kind === 'failed') expect(s.reason).toMatch(/invalid QR/);
  });
});

describe('PairingController — rejection + expiry', () => {
  test('rejecting the fingerprint fails the pairing', async () => {
    const { transport, controller } = setup();
    await controller.host();
    transport.emitStatus({ type: 'connected', peerId: 'peer-host' });
    controller.reject();
    expect(controller.getState().kind).toBe('failed');
  });

  test('ticket expiry fails the pairing', async () => {
    const { transport, controller } = setup();
    transport.mintExpiresInMs = 5;
    await controller.host();
    await new Promise((r) => setTimeout(r, 25));
    await tick();
    const s = controller.getState();
    expect(s.kind).toBe('failed');
    if (s.kind === 'failed') expect(s.reason).toMatch(/expired/);
  });
});
