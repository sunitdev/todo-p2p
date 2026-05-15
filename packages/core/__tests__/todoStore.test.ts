import { describe, expect, test } from "bun:test";
import { TodoStore } from "../src/todoStore.ts";

describe("TodoStore", () => {
  test("create + add + list", () => {
    const s = TodoStore.create();
    s.add({ id: "a", title: "buy milk" });
    s.add({ id: "b", title: "walk dog" });
    const items = s.list();
    expect(items.length).toBe(2);
    expect(items[0]?.title).toBe("buy milk");
    expect(items[0]?.done).toBe(false);
  });

  test("toggle flips done and sets completedAt", () => {
    const s = TodoStore.create();
    s.add({ id: "a", title: "x" });
    s.toggle("a");
    const t = s.get("a");
    expect(t?.done).toBe(true);
    expect(typeof t?.completedAt).toBe("number");
  });

  test("remove removes from order and todos", () => {
    const s = TodoStore.create();
    s.add({ id: "a", title: "x" });
    s.add({ id: "b", title: "y" });
    s.remove("a");
    expect(s.list().map((t) => t.id)).toEqual(["b"]);
    expect(s.get("a")).toBeUndefined();
  });

  test("save + load roundtrip preserves state", () => {
    const s = TodoStore.create();
    s.add({ id: "a", title: "x" });
    s.toggle("a");
    const bytes = s.save();
    const reloaded = TodoStore.load(bytes);
    const t = reloaded.get("a");
    expect(t?.done).toBe(true);
  });

  test("applyChange merges remote add", () => {
    const a = TodoStore.create();
    const b = TodoStore.load(a.save());
    const change = b.add({ id: "x", title: "remote" });
    expect(a.applyChange(change)).toBe(true);
    expect(a.get("x")?.title).toBe("remote");
  });
});
