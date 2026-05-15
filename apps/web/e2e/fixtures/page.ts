import { test as base, expect } from '@playwright/test';

/**
 * Clears OPFS + IndexedDB on each test so persistence assertions start fresh.
 * Must run BEFORE the page navigates so the app boots against empty storage.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(async () => {
      try {
        const root = await navigator.storage.getDirectory();
        // @ts-expect-error - keys() exists on FileSystemDirectoryHandle in modern browsers
        for await (const name of root.keys()) {
          await root.removeEntry(name, { recursive: true });
        }
      } catch {
        // OPFS may be unavailable before the page loads — silently skip.
      }
      try {
        await new Promise<void>((res) => {
          const r = indexedDB.deleteDatabase('todo-p2p-keys');
          r.onsuccess = () => res();
          r.onerror = () => res();
          r.onblocked = () => res();
        });
      } catch {
        /* ignore */
      }
    });
    await use(page);
  },
});

export { expect };
