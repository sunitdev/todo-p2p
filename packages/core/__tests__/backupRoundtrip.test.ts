import { describe, expect, test } from "bun:test";
import { SyncEngine } from "../src/syncEngine.ts";
import { encryptBackup, decryptBackup } from "../src/backup.ts";
import { MemStorage } from "./helpers/MemStorage.ts";
import { MemTransport } from "./helpers/MemTransport.ts";

/**
 * The M3 data-safety guarantee end-to-end: a backup taken from a populated
 * device restores the exact state onto a freshly-wiped one (P9.5 + P9.6).
 */
describe("backup export → wipe → import round-trip", () => {
  test("restores todos, areas, and projects exactly", async () => {
    const storage = new MemStorage();
    const engine = await SyncEngine.open(storage, new MemTransport());

    engine.todos().addArea({ id: "work", name: "Work", color: "tint" });
    engine.todos().addProject({
      id: "p1",
      title: "Q3 launch",
      icon: { kind: "lucide", name: "Rocket" },
      color: "purple",
      areaId: "work",
    });
    await engine.commit(engine.todos().add({ id: "a", title: "Buy milk" }), []);
    await engine.commit(engine.todos().add({ id: "b", title: "Walk dog" }), []);

    // Export: snapshot → sealed file.
    const passphrase = "correct horse battery staple";
    const file = await encryptBackup(engine.todos().save(), passphrase);
    await engine.close();

    // Wipe: storage is empty afterwards.
    await storage.wipe();
    expect(await storage.loadDoc()).toBeNull();
    const wiped = await SyncEngine.open(storage, new MemTransport());
    expect(wiped.todos().list()).toEqual([]);
    await wiped.close();

    // Import: decrypt → persist snapshot → reopen restores everything.
    const snapshot = await decryptBackup(file, passphrase);
    await storage.saveDoc(snapshot);
    await storage.truncateChanges();

    const restored = await SyncEngine.open(storage, new MemTransport());
    expect(restored.todos().get("a")?.title).toBe("Buy milk");
    expect(restored.todos().get("b")?.title).toBe("Walk dog");
    expect(restored.todos().getArea("work")?.name).toBe("Work");
    expect(restored.todos().getProject("p1")?.title).toBe("Q3 launch");

    // Restored state stays mutable — new edits commit cleanly.
    await restored.commit(restored.todos().add({ id: "c", title: "Post-restore" }), []);
    expect(restored.todos().get("c")?.title).toBe("Post-restore");
    await restored.close();
  });
});
