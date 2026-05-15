import { describe, expect, test } from "bun:test";
import type { StorageAdapter, TrustedPeer } from "../../src/adapters/index.ts";

/**
 * Conformance suite reusable by every StorageAdapter implementation.
 * Pass a `make` factory that yields a fresh adapter on each call.
 */
export function storageAdapterContract(
  label: string,
  make: () => Promise<StorageAdapter>,
): void {
  describe(`StorageAdapter contract: ${label}`, () => {
    test("loadDoc on empty storage returns null", async () => {
      const a = await make();
      expect(await a.loadDoc()).toBeNull();
    });

    test("saveDoc + loadDoc roundtrip preserves bytes", async () => {
      const a = await make();
      const bytes = new Uint8Array([1, 2, 3, 4, 255]);
      await a.saveDoc(bytes);
      const loaded = await a.loadDoc();
      expect(loaded).toEqual(bytes);
    });

    test("appendChange + loadChanges preserves order", async () => {
      const a = await make();
      const c1 = new Uint8Array([1]);
      const c2 = new Uint8Array([2, 3]);
      const c3 = new Uint8Array([4]);
      await a.appendChange(c1);
      await a.appendChange(c2);
      await a.appendChange(c3);
      const got = await a.loadChanges();
      expect(got.length).toBe(3);
      expect(got[0]).toEqual(c1);
      expect(got[1]).toEqual(c2);
      expect(got[2]).toEqual(c3);
    });

    test("truncateChanges empties the log", async () => {
      const a = await make();
      await a.appendChange(new Uint8Array([1]));
      await a.appendChange(new Uint8Array([2]));
      await a.truncateChanges();
      expect(await a.loadChanges()).toEqual([]);
    });

    test("trusted peers: save, list, remove roundtrip", async () => {
      const a = await make();
      expect(await a.loadTrustedPeers()).toEqual([]);
      const peer: TrustedPeer = {
        nodeId: "node-abc",
        publicKey: new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]),
        pairedAt: 1715000000000,
        lastSeenAt: 1715000001000,
      };
      await a.saveTrustedPeer(peer);
      const list = await a.loadTrustedPeers();
      expect(list.length).toBe(1);
      expect(list[0]?.nodeId).toBe("node-abc");
      expect(list[0]?.publicKey).toEqual(peer.publicKey);
      expect(list[0]?.pairedAt).toBe(peer.pairedAt);

      await a.removeTrustedPeer("node-abc");
      expect(await a.loadTrustedPeers()).toEqual([]);
    });

    test("saveDoc replaces previous bytes, not appends", async () => {
      const a = await make();
      await a.saveDoc(new Uint8Array([1, 1]));
      await a.saveDoc(new Uint8Array([2, 2, 2]));
      expect(await a.loadDoc()).toEqual(new Uint8Array([2, 2, 2]));
    });
  });
}
