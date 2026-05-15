import { describe, expect, test } from "bun:test";
import * as Automerge from "@automerge/automerge";
import { CURRENT_SCHEMA_VERSION, migrate } from "../src/migrations/index.ts";
import type { TodoDoc } from "../src/todoStore.ts";

describe("migrations", () => {
  test("v1 doc upgrades to current schema, gains areas/projects shape", () => {
    // Build a v1-shaped doc by hand (no areas/projects/areaOrder/projectOrder).
    type V1 = Pick<TodoDoc, "todos" | "order" | "meta">;
    const v1 = Automerge.change(Automerge.init<V1>(), "v1 init", (d) => {
      d.todos = { a: { id: "a", title: "x", done: false, createdAt: 1 } };
      d.order = ["a"];
      d.meta = { schemaVersion: 1 };
    });
    // Round-trip through save/load to detach the handle before migrating.
    const bytes = Automerge.save(v1);
    const loaded = Automerge.load<TodoDoc>(bytes);

    const upgraded = migrate(loaded);
    expect(upgraded.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(upgraded.areas).toEqual({});
    expect(upgraded.areaOrder).toEqual([]);
    expect(upgraded.projects).toEqual({});
    expect(upgraded.projectOrder).toEqual([]);
    // Existing data preserved.
    expect(upgraded.todos.a?.title).toBe("x");
  });

  test("v0 doc (no meta) upgrades cleanly to current schema", () => {
    type V0 = Pick<TodoDoc, "todos" | "order">;
    const v0 = Automerge.change(Automerge.init<V0>(), "v0 init", (d) => {
      d.todos = {};
      d.order = [];
    });
    const loaded = Automerge.load<TodoDoc>(Automerge.save(v0));
    const upgraded = migrate(loaded);
    expect(upgraded.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(upgraded.areas).toEqual({});
    expect(upgraded.areaOrder).toEqual([]);
    expect(upgraded.projects).toEqual({});
    expect(upgraded.projectOrder).toEqual([]);
  });

  test("doc already at current version: migrate is a heads-equal no-op", () => {
    const cur = Automerge.change(Automerge.init<TodoDoc>(), "init", (d) => {
      d.todos = {};
      d.order = [];
      d.areas = {};
      d.areaOrder = [];
      d.projects = {};
      d.projectOrder = [];
      d.meta = { schemaVersion: CURRENT_SCHEMA_VERSION };
    });
    const loaded = Automerge.load<TodoDoc>(Automerge.save(cur));
    const headsBefore = Automerge.getHeads(loaded).join();
    const after = migrate(loaded);
    expect(Automerge.getHeads(after).join()).toBe(headsBefore);
    expect(after.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  test("doc claiming a future schema version is preserved untouched (forward-compat)", () => {
    const future = Automerge.change(Automerge.init<TodoDoc>(), "future", (d) => {
      d.todos = {};
      d.order = [];
      d.areas = {};
      d.areaOrder = [];
      d.projects = {};
      d.projectOrder = [];
      d.meta = { schemaVersion: CURRENT_SCHEMA_VERSION + 5 };
    });
    const loaded = Automerge.load<TodoDoc>(Automerge.save(future));
    const after = migrate(loaded);
    expect(after.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION + 5);
  });

  test("v2 doc upgrades to v3, leaves existing todos untouched and new fields undefined", () => {
    const v2 = Automerge.change(Automerge.init<TodoDoc>(), "v2 init", (d) => {
      d.todos = { a: { id: "a", title: "Buy milk", done: false, createdAt: 1 } };
      d.order = ["a"];
      d.areas = {};
      d.areaOrder = [];
      d.projects = {};
      d.projectOrder = [];
      d.meta = { schemaVersion: 2 };
    });
    const loaded = Automerge.load<TodoDoc>(Automerge.save(v2));

    const upgraded = migrate(loaded);
    expect(upgraded.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const a = upgraded.todos.a;
    expect(a?.title).toBe("Buy milk");
    expect(a?.done).toBe(false);
    expect(a?.notes).toBeUndefined();
    expect(a?.dueDate).toBeUndefined();
    expect(a?.scheduledFor).toBeUndefined();
    expect(a?.scheduledWhen).toBeUndefined();
    expect(a?.flagged).toBeUndefined();
    expect(a?.areaId).toBeUndefined();
  });
});
