import { beforeEach, describe, expect, test } from "bun:test";
import { SyncEngine } from "../src/syncEngine.ts";
import { TodoStore } from "../src/todoStore.ts";
import { MemStorage } from "./helpers/MemStorage.ts";
import { MemTransport } from "./helpers/MemTransport.ts";

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

  test("first commit on empty storage persists snapshot (not append) so actor init survives reload", async () => {
    const events: string[] = [];
    engine.on((e) => events.push(e.kind));
    const change = engine.todos().add({ id: "a", title: "x" });
    await engine.commit(change, []);
    expect(storage.saveDocCalls).toBe(1);
    expect(storage.doc).not.toBeNull();
    expect(storage.changes.length).toBe(0);
    expect(events).toContain("local-change");
  });

  test("subsequent commits append change to log (no extra snapshot)", async () => {
    const c1 = engine.todos().add({ id: "a", title: "x" });
    await engine.commit(c1, []);
    const c2 = engine.todos().add({ id: "b", title: "y" });
    await engine.commit(c2, []);
    expect(storage.saveDocCalls).toBe(1);
    expect(storage.changes.length).toBe(1);
  });

  test("first commit survives a simulated reload (regression for skipped e2e)", async () => {
    const change = engine.todos().add({ id: "x", title: "survive" });
    await engine.commit(change, []);
    await engine.close();

    const reopened = await SyncEngine.open(storage, new MemTransport());
    expect(reopened.todos().get("x")?.title).toBe("survive");
  });

  test("incoming message merges into local store", async () => {
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
    storageB.doc = engine.todos().save();
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
