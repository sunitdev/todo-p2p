import * as Automerge from "@automerge/automerge";
import { CURRENT_SCHEMA_VERSION, migrate } from "./migrations/index.ts";

/**
 * Repeating-todo rule (rrule-lite). Stored on the seed; engine derives next
 * occurrence on completion. `interval` = every-N (1 = every period).
 */
export interface Recurrence {
  kind: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
  projectId?: string | null;
  areaId?: string | null;
  notes?: string;
  /** Hard deadline (epoch ms). Independent of `scheduledFor` (start). */
  dueDate?: number;
  scheduledFor?: number;
  scheduledWhen?: "today" | "someday" | null;
  flagged?: boolean;
  /** Repeating-rule for the todo. */
  recurrence?: Recurrence;
  /** When `scheduledWhen === 'today'`: true = "This Evening" group, else "This Morning". */
  eveningOnToday?: boolean;
  /** Project-scoped heading the todo lives under. */
  headingId?: string | null;
}

export type IconRef =
  | { kind: "lucide"; name: string }
  | { kind: "emoji"; value: string };

export const PALETTE_COLORS = [
  "tint",
  "blue",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "indigo",
  "purple",
  "pink",
  "tan",
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

/** Sub-divider inside a project; todos can be filed under a heading. */
export interface Heading {
  id: string;
  projectId: string;
  title: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface TodoDoc {
  todos: Record<string, Todo>;
  order: string[];
  areas: Record<string, Area>;
  areaOrder: string[];
  projects: Record<string, Project>;
  projectOrder: string[];
  headings: Record<string, Heading>;
  headingOrder: string[];
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
export type HeadingInput = {
  id: string;
  projectId: string;
  title: string;
  /** Optional; appended at end of project's headings when omitted. */
  order?: number;
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
      d.headings = {};
      d.headingOrder = [];
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
      if (input.projectId !== undefined) todo.projectId = input.projectId;
      if (input.areaId !== undefined) todo.areaId = input.areaId;
      if (input.notes !== undefined) todo.notes = input.notes;
      if (input.dueDate !== undefined) todo.dueDate = input.dueDate;
      if (input.scheduledFor !== undefined) todo.scheduledFor = input.scheduledFor;
      if (input.scheduledWhen !== undefined) todo.scheduledWhen = input.scheduledWhen;
      if (input.flagged !== undefined) todo.flagged = input.flagged;
      if (input.recurrence !== undefined) todo.recurrence = { ...input.recurrence };
      if (input.eveningOnToday !== undefined) todo.eveningOnToday = input.eveningOnToday;
      if (input.headingId !== undefined) todo.headingId = input.headingId;
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
        | "projectId"
        | "areaId"
        | "notes"
        | "dueDate"
        | "scheduledFor"
        | "scheduledWhen"
        | "flagged"
        | "recurrence"
        | "eveningOnToday"
        | "headingId"
      >
    >,
  ): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `update ${id}`, (d) => {
      const t = d.todos[id];
      if (!t) return;
      if (patch.title !== undefined) t.title = patch.title;
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
      if (patch.recurrence !== undefined) t.recurrence = { ...patch.recurrence };
      if (patch.eveningOnToday !== undefined) t.eveningOnToday = patch.eveningOnToday;
      if (patch.headingId !== undefined) t.headingId = patch.headingId;
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

  // ───────────────────────────────────────────────────────────────────────────
  // region: headings + recurrence (Phase 3 + 7 schema additions)
  // ───────────────────────────────────────────────────────────────────────────

  addHeading(input: HeadingInput): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `heading:add ${input.id}`, (d) => {
      const now = Date.now();
      // Compute order at write-time if caller didn't pin one. We count siblings
      // in the same project rather than using global headingOrder length so
      // ordering is project-local and predictable.
      const orderValue =
        input.order ??
        Object.values(d.headings).filter((h) => h.projectId === input.projectId).length;
      d.headings[input.id] = {
        id: input.id,
        projectId: input.projectId,
        title: input.title,
        order: orderValue,
        createdAt: now,
        updatedAt: now,
      };
      d.headingOrder.push(input.id);
    });
    return lastChange(before, this.doc);
  }

  updateHeading(
    id: string,
    patch: Partial<Pick<Heading, "title" | "order" | "projectId">>,
  ): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `heading:update ${id}`, (d) => {
      const h = d.headings[id];
      if (!h) return;
      if (patch.title !== undefined) h.title = patch.title;
      if (patch.order !== undefined) h.order = patch.order;
      if (patch.projectId !== undefined) h.projectId = patch.projectId;
      h.updatedAt = Date.now();
    });
    return lastChange(before, this.doc);
  }

  /** Removes a heading. Any todo that referenced it has `headingId` cleared. */
  removeHeading(id: string): Uint8Array {
    const before = this.doc;
    this.doc = Automerge.change(before, `heading:remove ${id}`, (d) => {
      delete d.headings[id];
      const idx = d.headingOrder.indexOf(id);
      if (idx >= 0) d.headingOrder.splice(idx, 1);
      for (const t of Object.values(d.todos)) {
        if (t.headingId === id) t.headingId = null;
      }
    });
    return lastChange(before, this.doc);
  }

  listHeadings(): Heading[] {
    return this.doc.headingOrder
      .map((id) => this.doc.headings[id])
      .filter((h): h is Heading => h !== undefined);
  }

  getHeading(id: string): Heading | undefined {
    return this.doc.headings[id];
  }

  // ── Filter helpers (read-only views over the current snapshot) ────────────

  getTodosByHeading(headingId: string): Todo[] {
    return this.list().filter((t) => t.headingId === headingId);
  }

  /** Today + explicitly marked as evening. */
  getEveningTodos(): Todo[] {
    return this.list().filter(
      (t) => t.scheduledWhen === "today" && t.eveningOnToday === true,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // region: row-level operations (Phase 2: drag-reorder + multi-select)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reorder a todo to a new visible index. `newIndex` is clamped to [0, len-1].
   * Returns `null` when the call is a no-op (missing id or same index) so
   * callers can skip emitting an empty sync packet.
   */
  reorderTodo(id: string, newIndex: number): Uint8Array | null {
    const before = this.doc;
    const currentIdx = before.order.indexOf(id);
    if (currentIdx < 0) return null;
    if (before.order.length === 0) return null;
    const clamped = Math.max(0, Math.min(newIndex, before.order.length - 1));
    if (clamped === currentIdx) return null;
    this.doc = Automerge.change(before, `reorder ${id}`, (d) => {
      d.order.splice(currentIdx, 1);
      d.order.splice(clamped, 0, id);
    });
    return lastChange(before, this.doc);
  }

  /**
   * Apply the same patch to many todos in one Automerge change so multi-select
   * actions land as one sync packet rather than N separate commits. Missing
   * ids are silently skipped; returns `null` when nothing was touched.
   */
  bulkUpdate(
    ids: readonly string[],
    patch: Partial<
      Pick<
        Todo,
        | "title"
        | "projectId"
        | "areaId"
        | "notes"
        | "dueDate"
        | "scheduledFor"
        | "scheduledWhen"
        | "flagged"
      > & { done?: boolean }
    >,
  ): Uint8Array | null {
    const before = this.doc;
    let touched = false;
    this.doc = Automerge.change(before, `bulk-update ${ids.length}`, (d) => {
      for (const id of ids) {
        const t = d.todos[id];
        if (!t) continue;
        touched = true;
        if (patch.title !== undefined) t.title = patch.title;
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
        if (patch.done !== undefined) {
          t.done = patch.done;
          if (patch.done) t.completedAt = Date.now();
          else delete t.completedAt;
        }
      }
    });
    if (!touched) {
      this.doc = before;
      return null;
    }
    return lastChange(before, this.doc);
  }
}

function lastChange(before: Automerge.Doc<TodoDoc>, after: Automerge.Doc<TodoDoc>): Uint8Array {
  const changes = Automerge.getChanges(before, after);
  const last = changes[changes.length - 1];
  if (!last) throw new Error("expected at least one change");
  return last;
}
