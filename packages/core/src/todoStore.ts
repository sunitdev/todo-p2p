import * as Automerge from "@automerge/automerge";
import { CURRENT_SCHEMA_VERSION, migrate } from "./migrations/index.ts";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
  tags?: string[];
}

export interface TodoDoc {
  todos: Record<string, Todo>;
  order: string[];
  meta: { schemaVersion: number };
}

export class TodoStore {
  private doc: Automerge.Doc<TodoDoc>;

  private constructor(doc: Automerge.Doc<TodoDoc>) {
    this.doc = doc;
  }

  static create(): TodoStore {
    const doc = Automerge.change(Automerge.init<TodoDoc>(), "init", (d) => {
      d.todos = {};
      d.order = [];
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
      d.todos[input.id] = {
        ...input,
        done: false,
        createdAt: Date.now(),
      };
      d.order.push(input.id);
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
