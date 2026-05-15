import * as Automerge from "@automerge/automerge";
import type { TodoDoc } from "../todoStore.ts";

export const CURRENT_SCHEMA_VERSION = 3;

type Migration = (doc: TodoDoc) => void;

const migrations: Record<number, Migration> = {
  2: (doc) => {
    doc.areas = doc.areas ?? {};
    doc.areaOrder = doc.areaOrder ?? [];
    doc.projects = doc.projects ?? {};
    doc.projectOrder = doc.projectOrder ?? [];
  },
  // v3 adds optional Todo fields (areaId, notes, dueDate, scheduledFor,
  // scheduledWhen, flagged). All optional → no structural backfill required.
  3: (_doc) => {},
};

/**
 * Apply pending migrations in order. Mutates the doc inside an Automerge change.
 * Runs on local doc load before any sync, so peers exchange current-schema changes only.
 */
export function migrate(doc: Automerge.Doc<TodoDoc>): Automerge.Doc<TodoDoc> {
  let current = doc;
  const from = current.meta?.schemaVersion ?? 0;
  for (let v = from + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v];
    current = Automerge.change(current, `migrate to v${v}`, (d) => {
      if (step) step(d);
      // Re-assigning `d.meta` to itself crashes Automerge with
      // "Cannot create a reference to an existing document object";
      // only initialise it when truly absent.
      if (!d.meta) d.meta = { schemaVersion: 0 };
      d.meta.schemaVersion = v;
    });
  }
  return current;
}
