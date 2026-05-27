import { describe, expect, test } from 'bun:test';
import { PeerManager } from '../../src/runtime/peerManager';
import { FakeStorage, FakeTransport, tick } from '../helpers/fakes';

function trustedPeer(nodeId: string) {
  return { nodeId, publicKey: new Uint8Array(), pairedAt: 0, lastSeenAt: 0 };
}

describe('PeerManager', () => {
  test('start() reconnects to each persisted trusted peer', async () => {
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    const pm = new PeerManager(transport, storage);

    const nodeId = await pm.start();
    await tick(); // let fire-and-forget reconnect settle

    expect(nodeId).toBe('self-node');
    expect(transport.dialedTrusted).toEqual(['peer-A']);
    expect(pm.peers().map((p) => p.peerId)).toEqual(['peer-A']);
  });

  test('inbound connected peers join the live set; disconnect removes them', async () => {
    const transport = new FakeTransport();
    const pm = new PeerManager(transport, new FakeStorage());
    await pm.start();

    transport.emitStatus({ type: 'connected', peerId: 'peer-B' });
    expect(pm.count()).toBe(1);
    expect(pm.peers()[0]?.peerId).toBe('peer-B');

    transport.emitStatus({ type: 'disconnected', peerId: 'peer-B' });
    expect(pm.count()).toBe(0);
  });

  test('a dialed id that answers with a different id is dropped + closed', async () => {
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    transport.dialTrustedImpl = async () => transport.connectionTo('IMPOSTOR');
    const pm = new PeerManager(transport, storage);

    await pm.start();
    await tick();

    expect(pm.count()).toBe(0);
    expect(transport.closed).toContain('IMPOSTOR');
  });

  test('a dropped trusted peer is re-dialed', async () => {
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    const pm = new PeerManager(transport, storage);
    await pm.start();
    await tick();
    expect(transport.dialedTrusted).toEqual(['peer-A']);

    transport.emitStatus({ type: 'disconnected', peerId: 'peer-A' });
    await tick();
    // dialed again on drop
    expect(transport.dialedTrusted).toEqual(['peer-A', 'peer-A']);
  });
});
