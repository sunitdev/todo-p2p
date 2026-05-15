import { describe, expect, test } from "bun:test";
import { TodoStore } from "../src/todoStore.ts";

describe("TodoStore edges", () => {
  test("applyChange is idempotent: second apply returns false, heads unchanged", () => {
    const a = TodoStore.create();
    const b = TodoStore.load(a.save());
    const change = b.add({ id: "x", title: "remote" });

    expect(a.applyChange(change)).toBe(true);
    const headsBefore = a.heads().join();
    expect(a.applyChange(change)).toBe(false);
    expect(a.heads().join()).toBe(headsBefore);
  });

  test("out-of-order apply still converges", () => {
    const root = TodoStore.create();
    const a = TodoStore.load(root.save());
    const b = TodoStore.load(root.save());
    const c1 = a.add({ id: "1", title: "one" });
    const c2 = a.add({ id: "2", title: "two" });

    // Apply in reverse order on b.
    b.applyChange(c2);
    b.applyChange(c1);

    expect(b.list().map((t) => t.id).sort()).toEqual(["1", "2"]);
    expect(b.heads().join()).toBe(a.heads().join());
  });

  test("concurrent edits to same todo title — both stores converge to identical state", () => {
    const root = TodoStore.create();
    root.add({ id: "x", title: "orig" });
    const a = TodoStore.load(root.save());
    const b = TodoStore.load(root.save());

    const ca = a.updateTodo("x", { title: "from-a" });
    const cb = b.updateTodo("x", { title: "from-b" });

    a.applyChange(cb);
    b.applyChange(ca);

    expect(a.get("x")?.title).toBe(b.get("x")!.title);
    expect(a.heads().join()).toBe(b.heads().join());
  });

  test("addProject with description: undefined does not throw (Automerge no-undefined guard)", () => {
    const s = TodoStore.create();
    expect(() =>
      s.addProject({
        id: "p1",
        title: "t",
        description: undefined,
        icon: { kind: "lucide", name: "Folder" },
        color: "tint",
        areaId: null,
      }),
    ).not.toThrow();
    expect(s.getProject("p1")?.description).toBeUndefined();
  });

  test("full mutation sequence + save/load round trip never throws (no self-reassign)", () => {
    const s = TodoStore.create();
    s.add({ id: "t1", title: "todo" });
    s.toggle("t1");
    s.toggle("t1");
    s.updateTodo("t1", { title: "renamed", notes: "n", tags: ["a"] });
    s.updateTodo("t1", { notes: "" });
    s.addArea({ id: "a1", name: "A", color: "tint" });
    s.updateArea("a1", { color: "indigo" });
    s.addProject({
      id: "p1",
      title: "P",
      icon: { kind: "emoji", value: "🛠" },
      color: "purple",
      areaId: "a1",
    });
    s.updateProject("p1", { title: "P2", description: "" });
    s.removeArea("a1");
    s.remove("t1");
    s.removeProject("p1");

    expect(() => TodoStore.load(s.save())).not.toThrow();
  });

  test("toggle then untoggle clears completedAt", () => {
    const s = TodoStore.create();
    s.add({ id: "a", title: "x" });
    s.toggle("a");
    expect(s.get("a")?.completedAt).toBeDefined();
    s.toggle("a");
    expect(s.get("a")?.done).toBe(false);
    expect(s.get("a")?.completedAt).toBeUndefined();
  });

  test("mutating an unknown id throws — current behavior of `lastChange`", () => {
    // Documents that `toggle`/`updateTodo`/`removeArea` on a missing id produce
    // zero Automerge changes, which `lastChange()` surfaces as a throw.
    // If this becomes a no-op in future, update this regression guard intentionally.
    const s = TodoStore.create();
    expect(() => s.toggle("ghost")).toThrow("expected at least one change");
    expect(() => s.updateTodo("ghost", { title: "x" })).toThrow("expected at least one change");
  });

  test("removeArea clears areaId of projects pointing at it", () => {
    const s = TodoStore.create();
    s.addArea({ id: "a1", name: "A", color: "tint" });
    s.addProject({
      id: "p1",
      title: "P",
      icon: { kind: "lucide", name: "Folder" },
      color: "tint",
      areaId: "a1",
    });
    s.removeArea("a1");
    expect(s.getProject("p1")?.areaId).toBeNull();
  });
});
