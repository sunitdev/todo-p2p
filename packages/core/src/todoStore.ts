import * as Automerge from "@automerge/automerge";
import { CURRENT_SCHEMA_VERSION, migrate } from "./migrations/index.ts";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
  tags?: string[];
  projectId?: string | null;
  areaId?: string | null;
  notes?: string;
  dueDate?: number;
  scheduledFor?: number;
  scheduledWhen?: "today" | "someday" | null;
  flagged?: boolean;
}

export type IconRef =
  | { kind: "lucide"; name: string }
  | { kind: "emoji"; value: string };

export const PALETTE_COLORS = [
  "tint",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "indigo",
  "purple",
  "pink",
  "gray",
] as const;

export type PaletteColor = (typeof PALETTE_COLORS)[number];

export interface Area {
  id: string;
  name: string;
  color: PaletteColor;
  createdAt: number;
}

export interface Project {
  id: string;
  title: string;
  description?: string | undefined;
  icon: IconRef;
  color: PaletteColor;
  areaId?: string | null | undefined;
  createdAt: number;
}

export interface TodoDoc {
  todos: Record<string, Todo>;
  order: string[];
  areas: Record<string, Area>;
  areaOrder: string[];
  projects: Record<string, Project>;
  projectOrder: string[];
  meta: { schemaVersion: number };
}

export type AreaInput = { id: string; name: string; color: PaletteColor };
export type ProjectInput = {
  id: string;
  title: string;
  description?: string | undefined;
  icon: IconRef;
  color: PaletteColor;
  areaId?: string | null | undefined;
};

export class TodoStore {
  private doc: Automerge.Doc<TodoDoc>;

  private constructor(doc: Automerge.Doc<TodoDoc>) {
    this.doc = doc;
  }

  static create(): TodoStore {
    const doc = Automerge.change(Automerge.init<TodoDoc>(), "init", (d) => {
      d.todos = {};
      d.order = [];
      d.areas = {};
      d.areaOrder = [];
      d.projects = {};
      d.projectOrder = [];
      d.meta = { schemaVersion: CURRENT_SCHEMA_VERSION };
    });
    return new TodoStore(doc);
  }

  static load(bytes: Uint8Array): TodoStore {
    const loaded = Automerge.load<TodoDoc>(bytes);
    return new TodoStore(migrate(loaded));
  }

  save(): Uint8Array {
    return Automerge.save(this.doc);
  }

  /** Returns the wire-format Automerge change for the new todo. */
  add(input: Omit<Todo, "createdAt" | "done">): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `add ${input.id}`, (d) => {
      const todo: Todo = {
        id: input.id,
        title: input.title,
        done: false,
        createdAt: Date.now(),
      };
      if (input.tags !== undefined) todo.tags = input.tags;
      if (input.projectId !== undefined) todo.projectId = input.projectId;
      if (input.areaId !== undefined) todo.areaId = input.areaId;
      if (input.notes !== undefined) todo.notes = input.notes;
      if (input.dueDate !== undefined) todo.dueDate = input.dueDate;
      if (input.scheduledFor !== undefined) todo.scheduledFor = input.scheduledFor;
      if (input.scheduledWhen !== undefined) todo.scheduledWhen = input.scheduledWhen;
      if (input.flagged !== undefined) todo.flagged = input.flagged;
      d.todos[input.id] = todo;
      d.order.push(input.id);
    });
    return lastChange(before, this.doc);
  }

  /** Patch mutable fields. Cannot toggle `done` — use `toggle`. */
  updateTodo(
    id: string,
    patch: Partial<
      Pick<
        Todo,
        | "title"
        | "tags"
        | "projectId"
        | "areaId"
        | "notes"
        | "dueDate"
        | "scheduledFor"
        | "scheduledWhen"
        | "flagged"
      >
    >,
  ): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `update ${id}`, (d) => {
      const t = d.todos[id];
      if (!t) return;
      if (patch.title !== undefined) t.title = patch.title;
      if (patch.tags !== undefined) t.tags = patch.tags;
      if (patch.projectId !== undefined) t.projectId = patch.projectId;
      if (patch.areaId !== undefined) t.areaId = patch.areaId;
      if (patch.notes !== undefined) {
        if (patch.notes === "") delete t.notes;
        else t.notes = patch.notes;
      }
      if (patch.dueDate !== undefined) t.dueDate = patch.dueDate;
      if (patch.scheduledFor !== undefined) t.scheduledFor = patch.scheduledFor;
      if (patch.scheduledWhen !== undefined) t.scheduledWhen = patch.scheduledWhen;
      if (patch.flagged !== undefined) t.flagged = patch.flagged;
    });
    return lastChange(before, this.doc);
  }

  toggle(id: string): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `toggle ${id}`, (d) => {
      const t = d.todos[id];
      if (!t) return;
      t.done = !t.done;
      if (t.done) t.completedAt = Date.now();
      else delete t.completedAt;
    });
    return lastChange(before, this.doc);
  }

  remove(id: string): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `remove ${id}`, (d) => {
      delete d.todos[id];
      const idx = d.order.indexOf(id);
      if (idx >= 0) d.order.splice(idx, 1);
    });
    return lastChange(before, this.doc);
  }

  addArea(input: AreaInput): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `area:add ${input.id}`, (d) => {
      d.areas[input.id] = { ...input, createdAt: Date.now() };
      d.areaOrder.push(input.id);
    });
    return lastChange(before, this.doc);
  }

  updateArea(id: string, patch: Partial<Omit<Area, "id" | "createdAt">>): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `area:update ${id}`, (d) => {
      const a = d.areas[id];
      if (!a) return;
      if (patch.name !== undefined) a.name = patch.name;
      if (patch.color !== undefined) a.color = patch.color;
    });
    return lastChange(before, this.doc);
  }

  /** Deletes the area. Projects in it become standalone (areaId cleared). */
  removeArea(id: string): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `area:remove ${id}`, (d) => {
      delete d.areas[id];
      const idx = d.areaOrder.indexOf(id);
      if (idx >= 0) d.areaOrder.splice(idx, 1);
      for (const p of Object.values(d.projects)) {
        if (p.areaId === id) p.areaId = null;
      }
    });
    return lastChange(before, this.doc);
  }

  addProject(input: ProjectInput): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `project:add ${input.id}`, (d) => {
      // Automerge rejects `undefined` values — only include description when present.
      const project: Project = {
        id: input.id,
        title: input.title,
        icon: input.icon,
        color: input.color,
        areaId: input.areaId ?? null,
        createdAt: Date.now(),
      };
      if (input.description) project.description = input.description;
      d.projects[input.id] = project;
      d.projectOrder.push(input.id);
    });
    return lastChange(before, this.doc);
  }

  updateProject(id: string, patch: Partial<Omit<Project, "id" | "createdAt">>): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `project:update ${id}`, (d) => {
      const p = d.projects[id];
      if (!p) return;
      if (patch.title !== undefined) p.title = patch.title;
      if (patch.description !== undefined) {
        if (patch.description === '') delete p.description;
        else p.description = patch.description;
      }
      if (patch.icon !== undefined) p.icon = patch.icon;
      if (patch.color !== undefined) p.color = patch.color;
      if (patch.areaId !== undefined) p.areaId = patch.areaId;
    });
    return lastChange(before, this.doc);
  }

  removeProject(id: string): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `project:remove ${id}`, (d) => {
      delete d.projects[id];
      const idx = d.projectOrder.indexOf(id);
      if (idx >= 0) d.projectOrder.splice(idx, 1);
    });
    return lastChange(before, this.doc);
  }

  /** Apply a remote change. Returns true if the doc actually changed. */
  applyChange(change: Uint8Array): boolean {
    const [next] = Automerge.applyChanges(this.doc, [change]);
    const changed = Automerge.getHeads(next).join() !== Automerge.getHeads(this.doc).join();
    this.doc = next;
    return changed;
  }

  list(): Todo[] {
    return this.doc.order
      .map((id) => this.doc.todos[id])
      .filter((t): t is Todo => t !== undefined);
  }

  get(id: string): Todo | undefined {
    return this.doc.todos[id];
  }

  listAreas(): Area[] {
    return this.doc.areaOrder
      .map((id) => this.doc.areas[id])
      .filter((a): a is Area => a !== undefined);
  }

  getArea(id: string): Area | undefined {
    return this.doc.areas[id];
  }

  listProjects(): Project[] {
    return this.doc.projectOrder
      .map((id) => this.doc.projects[id])
      .filter((p): p is Project => p !== undefined);
  }

  getProject(id: string): Project | undefined {
    return this.doc.projects[id];
  }

  /** Heads, for sync engine to compute diffs. */
  heads(): Automerge.Heads {
    return Automerge.getHeads(this.doc);
  }
}

function lastChange(before: Automerge.Doc<TodoDoc>, after: Automerge.Doc<TodoDoc>): Uint8Array {
  const changes = Automerge.getChanges(before, after);
  const last = changes[changes.length - 1];
  if (!last) throw new Error("expected at least one change");
  return last;
}
