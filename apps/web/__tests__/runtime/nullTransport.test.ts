import { describe, expect, test } from 'bun:test';
import { NullTransport } from '../../src/runtime/nullTransport';

describe('NullTransport', () => {
  test('start returns "null-node"', async () => {
    const t = new NullTransport();
    expect(await t.start()).toBe('null-node');
  });

  test('stop resolves', async () => {
    const t = new NullTransport();
    await expect(t.stop()).resolves.toBeUndefined();
  });

  test('mintPairingTicket rejects with documented message', () => {
    const t = new NullTransport();
    expect(t.mintPairingTicket()).rejects.toThrow('pairing unavailable');
  });

  test('dialWithTicket rejects', () => {
    const t = new NullTransport();
    expect(t.dialWithTicket()).rejects.toThrow('pairing unavailable');
  });

  test('dialTrusted rejects', () => {
    const t = new NullTransport();
    expect(t.dialTrusted()).rejects.toThrow('pairing unavailable');
  });

  test('onMessage returns callable unsubscribe', () => {
    const t = new NullTransport();
    const off = t.onMessage();
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });

  test('onPeerStatus returns callable unsubscribe', () => {
    const t = new NullTransport();
    const off = t.onPeerStatus(() => {});
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });
});
