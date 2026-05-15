import { describe, expect, test } from "bun:test";
import { SyncEngine, type SyncEvent } from "../src/syncEngine.ts";
import { TodoStore } from "../src/todoStore.ts";
import { FakePeer, MemTransport } from "./helpers/MemTransport.ts";
import { MemStorage } from "./helpers/MemStorage.ts";

describe("SyncEngine advanced", () => {
  test("open replays changes log on top of snapshot", async () => {
    const seed = TodoStore.create();
    seed.add({ id: "snap", title: "in snapshot" });
    const snapshot = seed.save();
    const change = seed.add({ id: "log", title: "in log" });

    const storage = new MemStorage();
    storage.doc = snapshot;
    storage.changes.push(change);

    const engine = await SyncEngine.open(storage, new MemTransport());
    const ids = engine.todos().list().map((t) => t.id).sort();
    expect(ids).toEqual(["log", "snap"]);
  });

  test("commit emits error 'send' when peer.send rejects but storage still wrote", async () => {
    const storage = new MemStorage();
    storage.doc = TodoStore.create().save();
    const engine = await SyncEngine.open(storage, new MemTransport());
    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));

    const peer = new FakePeer("bad");
    peer.failNext = new Error("link down");
    const change = engine.todos().add({ id: "a", title: "x" });
    await engine.commit(change, [peer]);

    expect(storage.changes.length).toBe(1);
    const err = events.find((e) => e.kind === "error");
    expect(err?.kind).toBe("error");
    if (err?.kind === "error") expect(err.phase).toBe("send");
  });

  test("commit emits error 'save' when appendChange rejects", async () => {
    const storage = new MemStorage();
    storage.doc = TodoStore.create().save();
    const engine = await SyncEngine.open(storage, new MemTransport());
    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));

    storage.failNext.appendChange = new Error("disk full");
    const change = engine.todos().add({ id: "a", title: "x" });
    await engine.commit(change, []);

    const err = events.find((e) => e.kind === "error");
    expect(err?.kind).toBe("error");
    if (err?.kind === "error") expect(err.phase).toBe("save");
  });

  test("commit emits error 'save' when first-commit saveDoc rejects", async () => {
    const storage = new MemStorage();
    const engine = await SyncEngine.open(storage, new MemTransport());
    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));

    storage.failNext.saveDoc = new Error("disk full");
    const change = engine.todos().add({ id: "a", title: "x" });
    await engine.commit(change, []);

    const err = events.find((e) => e.kind === "error");
    expect(err?.kind).toBe("error");
    if (err?.kind === "error") expect(err.phase).toBe("save");
  });

  test("handleRemote: already-applied change does not re-emit or re-append", async () => {
    const storage = new MemStorage();
    const transport = new MemTransport();
    const engine = await SyncEngine.open(storage, transport);
    const remote = TodoStore.load(engine.todos().save());
    const change = remote.add({ id: "x", title: "from peer" });

    transport.inject("peer-1", change);
    await new Promise((r) => setTimeout(r, 0));
    const appendsAfterFirst = storage.appendCalls;
    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));

    // Re-inject identical change.
    transport.inject("peer-1", change);
    await new Promise((r) => setTimeout(r, 0));

    expect(storage.appendCalls).toBe(appendsAfterFirst);
    expect(events.find((e) => e.kind === "remote-change")).toBeUndefined();
  });

  test("close with zero pending changes does not call saveDoc", async () => {
    const storage = new MemStorage();
    const engine = await SyncEngine.open(storage, new MemTransport());
    await engine.close();
    expect(storage.saveDocCalls).toBe(0);
    expect(storage.truncateCalls).toBe(0);
  });

  test("snapshot triggers every 50 appends since last snapshot", async () => {
    const storage = new MemStorage();
    const engine = await SyncEngine.open(storage, new MemTransport());
    let snapshots = 0;
    engine.on((e) => {
      if (e.kind === "snapshot-saved") snapshots++;
    });

    const c0 = engine.todos().add({ id: "t0", title: "0" });
    await engine.commit(c0, []);
    expect(snapshots).toBe(1);
    expect(storage.saveDocCalls).toBe(1);
    expect(storage.changes.length).toBe(0);

    for (let i = 1; i <= 49; i++) {
      const c = engine.todos().add({ id: `t${i}`, title: String(i) });
      await engine.commit(c, []);
    }
    expect(snapshots).toBe(1);
    expect(storage.changes.length).toBe(49);

    const c50 = engine.todos().add({ id: "t50", title: "50" });
    await engine.commit(c50, []);
    expect(snapshots).toBe(2);
    expect(storage.saveDocCalls).toBe(2);
    expect(storage.changes.length).toBe(0);

    const cExtra = engine.todos().add({ id: "extra", title: "extra" });
    await engine.commit(cExtra, []);
    expect(snapshots).toBe(2);
  });

  test("after close, transport messages no longer mutate the store", async () => {
    const storage = new MemStorage();
    const transport = new MemTransport();
    const engine = await SyncEngine.open(storage, transport);
    await engine.close();

    const remote = TodoStore.load(engine.todos().save());
    const change = remote.add({ id: "z", title: "post-close" });
    transport.inject("peer-1", change);
    await new Promise((r) => setTimeout(r, 0));

    expect(engine.todos().get("z")).toBeUndefined();
  });
});
