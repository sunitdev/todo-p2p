import { describe, expect, test } from 'bun:test';
import type { TrustedPeer } from '@todo-p2p/core/adapters';
import { TauriStorageAdapter } from '../../src/runtime/tauriStorage';

/**
 * Verifies the IPC marshalling of `TauriStorageAdapter`: Array.from on the way
 * out, Uint8Array.from on the way back, and the camelCase argument keys Tauri
 * expects. The mock invoke stands in for the Rust `storage_*` commands with an
 * in-memory backend that asserts the wire shapes. The actual SQLCipher behavior
 * is covered by the Rust contract tests; this can't reach a Tauri runtime.
 */
interface PeerDto {
  nodeId: string;
  publicKey: number[];
  pairedAt: number;
  lastSeenAt: number;
}

function mockBackend() {
  let doc: number[] | null = null;
  let changes: number[][] = [];
  let peers: PeerDto[] = [];

  const assertNumberArray = (v: unknown) => {
    expect(Array.isArray(v)).toBe(true);
    for (const n of v as unknown[]) expect(typeof n).toBe('number');
    return v as number[];
  };

  const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
    switch (cmd) {
      case 'storage_load_doc':
        return doc as T;
      case 'storage_save_doc':
        doc = assertNumberArray(args?.bytes);
        return undefined as T;
      case 'storage_append_change':
        changes.push(assertNumberArray(args?.change));
        return undefined as T;
      case 'storage_load_changes':
        return changes as T;
      case 'storage_truncate_changes':
        changes = [];
        return undefined as T;
      case 'storage_load_trusted_peers':
        return peers as T;
      case 'storage_save_trusted_peer': {
        const p = args?.peer as PeerDto;
        expect(typeof p.nodeId).toBe('string');
        assertNumberArray(p.publicKey);
        peers = peers.filter((q) => q.nodeId !== p.nodeId);
        peers.push(p);
        return undefined as T;
      }
      case 'storage_remove_trusted_peer':
        peers = peers.filter((q) => q.nodeId !== (args?.nodeId as string));
        return undefined as T;
      default:
        throw new Error(`unexpected command ${cmd}`);
    }
  };
  return invoke;
}

const adapter = () => TauriStorageAdapter.withInvoke(mockBackend());

describe('TauriStorageAdapter (mock invoke)', () => {
  test('loadDoc on empty storage returns null', async () => {
    expect(await adapter().loadDoc()).toBeNull();
  });

  test('saveDoc + loadDoc roundtrip preserves bytes', async () => {
    const a = adapter();
    const bytes = new Uint8Array([1, 2, 3, 4, 255]);
    await a.saveDoc(bytes);
    const loaded = await a.loadDoc();
    expect(loaded).toEqual(bytes);
    expect(loaded).toBeInstanceOf(Uint8Array);
  });

  test('appendChange + loadChanges preserves order', async () => {
    const a = adapter();
    await a.appendChange(new Uint8Array([1]));
    await a.appendChange(new Uint8Array([2, 3]));
    await a.appendChange(new Uint8Array([4]));
    const got = await a.loadChanges();
    expect(got).toEqual([new Uint8Array([1]), new Uint8Array([2, 3]), new Uint8Array([4])]);
  });

  test('truncateChanges empties the log', async () => {
    const a = adapter();
    await a.appendChange(new Uint8Array([1]));
    await a.truncateChanges();
    expect(await a.loadChanges()).toEqual([]);
  });

  test('trusted peers: save, list, remove roundtrip', async () => {
    const a = adapter();
    expect(await a.loadTrustedPeers()).toEqual([]);
    const peer: TrustedPeer = {
      nodeId: 'node-abc',
      publicKey: new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]),
      pairedAt: 1715000000000,
      lastSeenAt: 1715000001000,
    };
    await a.saveTrustedPeer(peer);
    const list = await a.loadTrustedPeers();
    expect(list.length).toBe(1);
    expect(list[0]?.nodeId).toBe('node-abc');
    expect(list[0]?.publicKey).toEqual(peer.publicKey);
    expect(list[0]?.publicKey).toBeInstanceOf(Uint8Array);

    await a.removeTrustedPeer('node-abc');
    expect(await a.loadTrustedPeers()).toEqual([]);
  });
});
