import { describe, expect, test } from "bun:test";
import { TodoStore } from "../src/todoStore.ts";

function seed(ids: string[]) {
  const s = TodoStore.create();
  for (const id of ids) s.add({ id, title: id });
  return s;
}

describe("TodoStore.reorderTodo", () => {
  test("moves last to first", () => {
    const s = seed(["a", "b", "c"]);
    const change = s.reorderTodo("c", 0);
    expect(change).not.toBeNull();
    expect(s.list().map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  test("moves first to last", () => {
    const s = seed(["a", "b", "c"]);
    s.reorderTodo("a", 2);
    expect(s.list().map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  test("middle row preserves siblings", () => {
    const s = seed(["a", "b", "c", "d"]);
    s.reorderTodo("b", 3);
    expect(s.list().map((t) => t.id)).toEqual(["a", "c", "d", "b"]);
  });

  test("same index is a no-op (returns null, no change emitted)", () => {
    const s = seed(["a", "b", "c"]);
    const headsBefore = s.heads();
    expect(s.reorderTodo("b", 1)).toBeNull();
    expect(s.heads()).toEqual(headsBefore);
    expect(s.list().map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  test("missing id returns null without mutation", () => {
    const s = seed(["a", "b"]);
    expect(s.reorderTodo("missing", 0)).toBeNull();
    expect(s.list().map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("clamps negative or out-of-range indices to bounds", () => {
    const s = seed(["a", "b", "c"]);
    s.reorderTodo("c", -5);
    expect(s.list().map((t) => t.id)).toEqual(["c", "a", "b"]);
    s.reorderTodo("a", 99);
    expect(s.list().map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  test("empty list returns null", () => {
    const s = TodoStore.create();
    expect(s.reorderTodo("any", 0)).toBeNull();
  });

  test("reorder change syncs to a remote replica", () => {
    const a = seed(["x", "y", "z"]);
    const b = TodoStore.load(a.save());
    const change = a.reorderTodo("z", 0)!;
    expect(b.applyChange(change)).toBe(true);
    expect(b.list().map((t) => t.id)).toEqual(["z", "x", "y"]);
  });
});

describe("TodoStore.bulkUpdate", () => {
  test("flags multiple todos in one change", () => {
    const s = seed(["a", "b", "c"]);
    const change = s.bulkUpdate(["a", "c"], { flagged: true });
    expect(change).not.toBeNull();
    expect(s.get("a")?.flagged).toBe(true);
    expect(s.get("b")?.flagged).toBeUndefined();
    expect(s.get("c")?.flagged).toBe(true);
  });

  test("done=true sets completedAt for each id", () => {
    const s = seed(["a", "b"]);
    s.bulkUpdate(["a", "b"], { done: true });
    expect(s.get("a")?.done).toBe(true);
    expect(typeof s.get("a")?.completedAt).toBe("number");
    expect(s.get("b")?.done).toBe(true);
  });

  test("done=false clears completedAt", () => {
    const s = seed(["a"]);
    s.bulkUpdate(["a"], { done: true });
    s.bulkUpdate(["a"], { done: false });
    expect(s.get("a")?.done).toBe(false);
    expect(s.get("a")?.completedAt).toBeUndefined();
  });

  test("notes='' deletes the field", () => {
    const s = TodoStore.create();
    s.add({ id: "a", title: "x", notes: "seed" });
    s.bulkUpdate(["a"], { notes: "" });
    expect(s.get("a")?.notes).toBeUndefined();
  });

  test("skips missing ids silently", () => {
    const s = seed(["a"]);
    const change = s.bulkUpdate(["a", "missing"], { flagged: true });
    expect(change).not.toBeNull();
    expect(s.get("a")?.flagged).toBe(true);
  });

  test("returns null and emits nothing when all ids are missing", () => {
    const s = seed(["a"]);
    const headsBefore = s.heads();
    expect(s.bulkUpdate(["nope", "neither"], { flagged: true })).toBeNull();
    expect(s.heads()).toEqual(headsBefore);
  });

  test("empty id list is a no-op", () => {
    const s = seed(["a"]);
    expect(s.bulkUpdate([], { flagged: true })).toBeNull();
  });
});
