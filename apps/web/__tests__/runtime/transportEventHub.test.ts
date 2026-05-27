import { describe, expect, test } from 'bun:test';
import { TransportEventHub } from '../../src/runtime/transportEventHub';

describe('TransportEventHub', () => {
  test('normalizes a number[] payload to Uint8Array', () => {
    const hub = new TransportEventHub();
    const got: Array<{ peerId: string; payload: Uint8Array }> = [];
    hub.onMessage((peerId, payload) => got.push({ peerId, payload }));

    hub.dispatch({ type: 'message', peerId: 'p1', payload: [1, 2, 3] });

    expect(got).toHaveLength(1);
    const first = got[0];
    expect(first).toBeDefined();
    expect(first?.peerId).toBe('p1');
    expect(first?.payload).toBeInstanceOf(Uint8Array);
    expect([...(first?.payload ?? [])]).toEqual([1, 2, 3]);
  });

  test('passes a Uint8Array payload through unchanged', () => {
    const hub = new TransportEventHub();
    const seen: Uint8Array[] = [];
    hub.onMessage((_p, payload) => seen.push(payload));
    const bytes = new Uint8Array([9, 8]);
    hub.dispatch({ type: 'message', peerId: 'p', payload: bytes });
    expect(seen[0]).toBe(bytes);
  });

  test('maps peerStatus variants to PeerStatusEvent', () => {
    const hub = new TransportEventHub();
    const events: unknown[] = [];
    hub.onPeerStatus((e) => events.push(e));

    hub.dispatch({ type: 'peerStatus', status: 'connected', peerId: 'a' });
    hub.dispatch({ type: 'peerStatus', status: 'disconnected', peerId: 'a' });
    hub.dispatch({ type: 'peerStatus', status: 'error', peerId: 'a', error: 'boom' });

    expect(events).toEqual([
      { type: 'connected', peerId: 'a' },
      { type: 'disconnected', peerId: 'a' },
      { type: 'error', peerId: 'a', error: 'boom' },
    ]);
  });

  test('unsubscribe stops delivery', () => {
    const hub = new TransportEventHub();
    let count = 0;
    const off = hub.onMessage(() => count++);
    hub.dispatch({ type: 'message', peerId: 'p', payload: [1] });
    off();
    hub.dispatch({ type: 'message', peerId: 'p', payload: [2] });
    expect(count).toBe(1);
  });
});
