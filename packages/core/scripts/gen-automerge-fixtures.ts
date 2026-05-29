/**
 * Generates Automerge binary fixtures with @automerge/automerge 2.2.8 (the JS
 * version pinned in packages/core) so the Rust `automerge` crate can be tested
 * for cross-format compatibility and migration parity. Run from packages/core
 * (where @automerge/automerge resolves):
 *   cd packages/core && bun run scripts/gen-automerge-fixtures.ts
 * Outputs into apps/desktop/src-tauri/tests/fixtures/.
 */
import * as Automerge from "@automerge/automerge";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// packages/core/scripts -> repo root is three levels up.
const OUT = join(
  import.meta.dir,
  "..", "..", "..",
  "apps/desktop/src-tauri/tests/fixtures",
);

// A legacy v1 doc: only todos/order exist, schemaVersion=1 — predates the
// areas/projects (v2) and headings (v4) collections. Rust migrate() must bring
// this to v4 by creating the missing top-level maps/lists.
interface LegacyV1 {
  todos: Record<string, { id: string; title: string; done: boolean; createdAt: number }>;
  order: string[];
  meta: { schemaVersion: number };
}
const v1 = Automerge.change(Automerge.init<LegacyV1>(), "init", (d) => {
  d.todos = {
    t1: { id: "t1", title: "buy milk", done: false, createdAt: 1715000000000 },
  };
  d.order = ["t1"];
  d.meta = { schemaVersion: 1 };
});
writeFileSync(join(OUT, "doc-v1.automerge"), Automerge.save(v1));

// A current v4 doc straight from the app's create() shape, with one todo. Used
// for the round-trip / load compatibility check (no migration expected).
interface DocV4 {
  todos: Record<string, unknown>;
  order: string[];
  areas: Record<string, unknown>;
  areaOrder: string[];
  projects: Record<string, unknown>;
  projectOrder: string[];
  headings: Record<string, unknown>;
  headingOrder: string[];
  meta: { schemaVersion: number };
}
const v4 = Automerge.change(Automerge.init<DocV4>(), "init", (d) => {
  d.todos = { a: { id: "a", title: "ship M2", done: false, createdAt: 1715000000001 } };
  d.order = ["a"];
  d.areas = {};
  d.areaOrder = [];
  d.projects = {};
  d.projectOrder = [];
  d.headings = {};
  d.headingOrder = [];
  d.meta = { schemaVersion: 4 };
});
writeFileSync(join(OUT, "doc-v4.automerge"), Automerge.save(v4));

console.log("wrote doc-v1.automerge, doc-v4.automerge to", OUT);
