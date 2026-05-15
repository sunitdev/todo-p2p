import * as Automerge from "@automerge/automerge";
import type { TodoDoc } from "../todoStore.ts";

export const CURRENT_SCHEMA_VERSION = 1;

type Migration = (doc: TodoDoc) => void;

const migrations: Record<number, Migration> = {
  // Future: 2: (doc) => { ... }
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
      d.meta = d.meta ?? { schemaVersion: 0 };
      d.meta.schemaVersion = v;
    });
  }
  return current;
}
