import { beforeEach, describe, expect, test } from "bun:test";
import type {
  PairingTicket,
  PeerConnection,
  PeerStatusEvent,
  StorageAdapter,
  TransportAdapter,
  TrustedPeer,
  Unsubscribe,
} from "../src/adapters/index.ts";
import { SyncEngine } from "../src/syncEngine.ts";
import { TodoStore } from "../src/todoStore.ts";

class MemStorage implements StorageAdapter {
  doc: Uint8Array | null = null;
  changes: Uint8Array[] = [];
  peers = new Map<string, TrustedPeer>();

  async loadDoc() {
    return this.doc;
  }
  async saveDoc(b: Uint8Array) {
    this.doc = b;
  }
  async appendChange(c: Uint8Array) {
    this.changes.push(c);
  }
  async loadChanges() {
    return [...this.changes];
  }
  async truncateChanges() {
    this.changes = [];
  }
  async loadTrustedPeers() {
    return [...this.peers.values()];
  }
  async saveTrustedPeer(p: TrustedPeer) {
    this.peers.set(p.nodeId, p);
  }
  async removeTrustedPeer(id: string) {
    this.peers.delete(id);
  }
}

type MessageHandler = (peerId: string, payload: Uint8Array) => void;

class MemTransport implements TransportAdapter {
  private handlers = new Set<MessageHandler>();
  async start() {
    return "node-mock";
  }
  async stop() {}
  async mintPairingTicket(ttl: number): Promise<PairingTicket> {
    return {
      ticket: "t",
      nodeId: "node-mock",
      pskHash: new Uint8Array(),
      expiresAt: Date.now() + ttl * 1000,
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
  onPeerStatus(_: (e: PeerStatusEvent) => void): Unsubscribe {
    return () => {};
  }
  /** Test helper: simulate a message arriving from `peerId`. */
  inject(peerId: string, payload: Uint8Array) {
    for (const h of this.handlers) h(peerId, payload);
  }
}

describe("SyncEngine", () => {
  let storage: MemStorage;
  let transport: MemTransport;
  let engine: SyncEngine;

  beforeEach(async () => {
    storage = new MemStorage();
    transport = new MemTransport();
    engine = await SyncEngine.open(storage, transport);
  });

  test("open with empty storage starts a fresh store", () => {
    expect(engine.todos().list()).toEqual([]);
  });

  test("commit appends change to storage and emits local-change", async () => {
    const events: string[] = [];
    engine.on((e) => events.push(e.kind));
    const change = engine.todos().add({ id: "a", title: "x" });
    await engine.commit(change, []);
    expect(storage.changes.length).toBe(1);
    expect(events).toContain("local-change");
  });

  test("incoming message merges into local store", async () => {
    // Remote derived from local snapshot — mirrors what initial pairing transfer does.
    const remoteStore = TodoStore.load(engine.todos().save());
    const change = remoteStore.add({ id: "r", title: "from peer" });
    const events: string[] = [];
    engine.on((e) => events.push(e.kind));
    transport.inject("peer-1", change);
    await new Promise((r) => setTimeout(r, 0));
    expect(engine.todos().get("r")?.title).toBe("from peer");
    expect(events).toContain("remote-change");
  });

  test("close persists snapshot if changes pending", async () => {
    const change = engine.todos().add({ id: "a", title: "x" });
    await engine.commit(change, []);
    await engine.close();
    expect(storage.doc).not.toBeNull();
    expect(storage.changes.length).toBe(0);
  });

  test("two diverged engines converge after exchanging changes", async () => {
    const storageB = new MemStorage();
    storageB.doc = engine.todos().save(); // pair B from A's snapshot
    const transportB = new MemTransport();
    const engineB = await SyncEngine.open(storageB, transportB);

    const ca = engine.todos().add({ id: "a", title: "from A" });
    const cb = engineB.todos().add({ id: "b", title: "from B" });

    transport.inject("B", cb);
    transportB.inject("A", ca);
    await new Promise((r) => setTimeout(r, 0));

    const ids = (s: SyncEngine) =>
      s.todos().list().map((t) => t.id).sort();
    expect(ids(engine)).toEqual(["a", "b"]);
    expect(ids(engineB)).toEqual(["a", "b"]);
  });
});
