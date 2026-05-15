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

  test("areas: add/update/remove", () => {
    const s = TodoStore.create();
    s.addArea({ id: "work", name: "Work", color: "tint" });
    expect(s.listAreas().map((a) => a.name)).toEqual(["Work"]);

    s.updateArea("work", { name: "Day Job", color: "indigo" });
    expect(s.getArea("work")?.name).toBe("Day Job");
    expect(s.getArea("work")?.color).toBe("indigo");

    s.addProject({
      id: "p1",
      title: "Q3 launch",
      icon: { kind: "lucide", name: "Rocket" },
      color: "purple",
      areaId: "work",
    });
    s.removeArea("work");
    expect(s.getArea("work")).toBeUndefined();
    expect(s.getProject("p1")?.areaId).toBeNull();
  });

  test("projects: add/update/remove + standalone", () => {
    const s = TodoStore.create();
    s.addProject({
      id: "p1",
      title: "Side quest",
      icon: { kind: "emoji", value: "🚀" },
      color: "orange",
    });
    expect(s.listProjects()).toHaveLength(1);
    expect(s.getProject("p1")?.areaId).toBeNull();

    s.updateProject("p1", { title: "Renamed", color: "green" });
    expect(s.getProject("p1")?.title).toBe("Renamed");
    expect(s.getProject("p1")?.color).toBe("green");

    s.removeProject("p1");
    expect(s.getProject("p1")).toBeUndefined();
  });

  test("updateTodo patches mutable fields, leaves others untouched", () => {
    const s = TodoStore.create();
    s.add({ id: "a", title: "Read book" });
    s.updateTodo("a", {
      title: "Read A Pattern Language",
      notes: "ch. 4",
      flagged: true,
      dueDate: 1715817600000,
      scheduledWhen: "today",
      tags: ["Reading"],
    });
    const t = s.get("a");
    expect(t?.title).toBe("Read A Pattern Language");
    expect(t?.notes).toBe("ch. 4");
    expect(t?.flagged).toBe(true);
    expect(t?.dueDate).toBe(1715817600000);
    expect(t?.scheduledWhen).toBe("today");
    expect(t?.tags).toEqual(["Reading"]);
    expect(t?.done).toBe(false);
  });

  test("updateTodo clears notes when patch is empty string", () => {
    const s = TodoStore.create();
    s.add({ id: "a", title: "x", notes: "seed" });
    s.updateTodo("a", { notes: "" });
    expect(s.get("a")?.notes).toBeUndefined();
  });

  test("save + load preserves areas and projects", () => {
    const s = TodoStore.create();
    s.addArea({ id: "a1", name: "Home", color: "teal" });
    s.addProject({
      id: "p1",
      title: "Kitchen reno",
      description: "phase 1",
      icon: { kind: "lucide", name: "Hammer" },
      color: "teal",
      areaId: "a1",
    });
    const reloaded = TodoStore.load(s.save());
    expect(reloaded.getArea("a1")?.name).toBe("Home");
    expect(reloaded.getProject("p1")?.title).toBe("Kitchen reno");
    expect(reloaded.getProject("p1")?.description).toBe("phase 1");
  });
});
