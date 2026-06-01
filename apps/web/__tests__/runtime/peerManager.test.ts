import { describe, expect, test } from 'bun:test';
import { PeerManager, type PeerManagerClock } from '../../src/runtime/peerManager';
import { FakeStorage, FakeTransport, tick } from '../helpers/fakes';

function trustedPeer(nodeId: string) {
  return { nodeId, publicKey: new Uint8Array(), pairedAt: 0, lastSeenAt: 0 };
}

/**
 * Deterministic clock for reconnect-backoff tests: records scheduled retries
 * (no real waiting) and lets the test fire them on demand. `rng=0.5` → zero net
 * jitter, so delays are the exact exponential values.
 */
class FakeClock implements PeerManagerClock {
  scheduled: Array<{ id: number; cb: () => void; ms: number }> = [];
  rngValue = 0.5;
  private seq = 0;

  setTimeout(cb: () => void, ms: number): unknown {
    const id = this.seq++;
    this.scheduled.push({ id, cb, ms });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.scheduled = this.scheduled.filter((s) => s.id !== handle);
  }
  rng(): number {
    return this.rngValue;
  }

  /** Fire the oldest pending timer and let microtasks settle. */
  async fireNext(): Promise<void> {
    const next = this.scheduled.shift();
    next?.cb();
    await tick();
  }
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
    const clock = new FakeClock();
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    transport.dialTrustedImpl = async () => transport.connectionTo('IMPOSTOR');
    const pm = new PeerManager(transport, storage, clock);

    await pm.start();
    await tick();

    expect(pm.count()).toBe(0);
    expect(transport.closed).toContain('IMPOSTOR');
    // Impostor answer is treated as a failed dial → backed-off retry armed.
    expect(clock.scheduled.length).toBe(1);
    await pm.stop();
  });

  test('a dropped trusted peer is re-dialed immediately', async () => {
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    const pm = new PeerManager(transport, storage);
    await pm.start();
    await tick();
    expect(transport.dialedTrusted).toEqual(['peer-A']);

    transport.emitStatus({ type: 'disconnected', peerId: 'peer-A' });
    await tick();
    // dialed again on drop (immediate, no backoff — the dial succeeds)
    expect(transport.dialedTrusted).toEqual(['peer-A', 'peer-A']);
  });

  test('a failed reconnect retries with exponential backoff until it succeeds', async () => {
    const clock = new FakeClock();
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    let attempts = 0;
    transport.dialTrustedImpl = async (id) => {
      attempts++;
      if (attempts < 3) throw new Error('offline');
      return transport.connectionTo(id);
    };
    const pm = new PeerManager(transport, storage, clock);

    await pm.start();
    await tick(); // attempt 1 (immediate) fails → schedule retry @ base
    expect(attempts).toBe(1);
    expect(pm.count()).toBe(0);
    expect(clock.scheduled.map((s) => s.ms)).toEqual([1000]);

    await clock.fireNext(); // attempt 2 fails → schedule retry @ 2×
    expect(attempts).toBe(2);
    expect(clock.scheduled.map((s) => s.ms)).toEqual([2000]);

    await clock.fireNext(); // attempt 3 succeeds
    expect(attempts).toBe(3);
    expect(pm.count()).toBe(1);
    expect(clock.scheduled.length).toBe(0); // no further retry

    await pm.stop();
  });

  test('backoff resets after a successful reconnect', async () => {
    const clock = new FakeClock();
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    let failing = true;
    transport.dialTrustedImpl = async (id) => {
      if (failing) throw new Error('offline');
      return transport.connectionTo(id);
    };
    const pm = new PeerManager(transport, storage, clock);

    await pm.start();
    await tick(); // fail → retry @ 1000
    await clock.fireNext(); // fail → retry @ 2000
    expect(clock.scheduled.map((s) => s.ms)).toEqual([2000]);

    failing = false;
    await clock.fireNext(); // succeeds → backoff reset
    expect(pm.count()).toBe(1);

    // A fresh drop should start again from the base delay, not 4000.
    failing = true;
    transport.emitStatus({ type: 'disconnected', peerId: 'peer-A' });
    await tick();
    expect(clock.scheduled.map((s) => s.ms)).toEqual([1000]);

    await pm.stop();
  });

  test('onStatus reports reconnecting during retries and connected on success', async () => {
    const clock = new FakeClock();
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    let ok = false;
    transport.dialTrustedImpl = async (id) => {
      if (!ok) throw new Error('offline');
      return transport.connectionTo(id);
    };
    const pm = new PeerManager(transport, storage, clock);
    const states: string[] = [];
    pm.onStatus((e) => states.push(e.state));

    await pm.start();
    await tick(); // fail → reconnecting
    expect(states).toContain('reconnecting');

    ok = true;
    await clock.fireNext(); // success → connected
    expect(states[states.length - 1]).toBe('connected');

    await pm.stop();
  });

  test('stop() clears pending retry timers', async () => {
    const clock = new FakeClock();
    const transport = new FakeTransport();
    const storage = new FakeStorage();
    storage.trusted = [trustedPeer('peer-A')];
    transport.dialTrustedImpl = async () => {
      throw new Error('offline');
    };
    const pm = new PeerManager(transport, storage, clock);

    await pm.start();
    await tick();
    expect(clock.scheduled.length).toBe(1);

    await pm.stop();
    expect(clock.scheduled.length).toBe(0);
  });
});
