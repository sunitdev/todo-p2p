import { TodoStore, type SyncEngine, type SyncEvent } from '@todo-p2p/core';

type Listener = (e: SyncEvent) => void;

/**
 * Fake `SyncEngine` for UI tests: wraps a real `TodoStore`, records commits,
 * and lets tests inject events. Implements only what `StoreProvider` consumes.
 */
export class FakeEngine {
  private store: TodoStore;
  private listeners = new Set<Listener>();
  commits: Uint8Array[] = [];
  unsubscribeCount = 0;

  constructor(store?: TodoStore) {
    this.store = store ?? TodoStore.create();
  }

  todos(): TodoStore {
    return this.store;
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.unsubscribeCount++;
      this.listeners.delete(listener);
    };
  }

  async commit(change: Uint8Array, _peers: { send(p: Uint8Array): Promise<void> }[]) {
    this.commits.push(change);
    for (const l of this.listeners) l({ kind: 'local-change', bytes: change });
  }

  async close() {}

  /** Test helper: simulate a remote change arrival. */
  injectRemote(peerId: string, bytes: Uint8Array) {
    this.store.applyChange(bytes);
    for (const l of this.listeners) l({ kind: 'remote-change', peerId, bytes });
  }

  /** Type assertion to plug into `<StoreProvider engine={...}>`. */
  asEngine(): SyncEngine {
    return this as unknown as SyncEngine;
  }
}
