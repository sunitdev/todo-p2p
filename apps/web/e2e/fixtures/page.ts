import { test as base, expect } from '@playwright/test';

// Clears OPFS + IndexedDB once per test (gated by sessionStorage so page.reload
// doesn't re-wipe state that the test is asserting survives).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(async () => {
      if (sessionStorage.getItem('todo-p2p-test-cleared')) return;
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
      sessionStorage.setItem('todo-p2p-test-cleared', '1');
    });
    await use(page);
  },
});

export { expect };
