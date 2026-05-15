import type { StorageAdapter, TransportAdapter, Unsubscribe } from "./adapters/index.ts";
import { TodoStore } from "./todoStore.ts";

type Listener<T> = (value: T) => void;

export type SyncEvent =
  | { kind: "local-change"; bytes: Uint8Array }
  | { kind: "remote-change"; peerId: string; bytes: Uint8Array }
  | { kind: "snapshot-saved" }
  | { kind: "error"; error: Error; phase: "load" | "apply" | "send" | "save" };

/**
 * Wires the in-memory TodoStore to a StorageAdapter (persistence) and a
 * TransportAdapter (peer messaging). UI subscribes to events; never throws.
 */
export class SyncEngine {
  private listeners = new Set<Listener<SyncEvent>>();
  private unsubscribers: Unsubscribe[] = [];
  private snapshotEvery = 50;
  private appendsSinceSnapshot = 0;

  constructor(
    private readonly store: TodoStore,
    private readonly storage: StorageAdapter,
    private readonly transport: TransportAdapter,
  ) {}

  /** Hydrate from storage, then start listening for remote messages. */
  static async open(storage: StorageAdapter, transport: TransportAdapter): Promise<SyncEngine> {
    const snapshot = await storage.loadDoc();
    const store = snapshot ? TodoStore.load(snapshot) : TodoStore.create();
    const changes = await storage.loadChanges();
    for (const c of changes) store.applyChange(c);

    const engine = new SyncEngine(store, storage, transport);
    engine.unsubscribers.push(
      transport.onMessage((peerId, payload) => {
        void engine.handleRemote(peerId, payload);
      }),
    );
    return engine;
  }

  on(listener: Listener<SyncEvent>): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  todos(): TodoStore {
    return this.store;
  }

  /** Apply a local mutation and broadcast its change to all paired peers. */
  async commit(change: Uint8Array, peers: { send(p: Uint8Array): Promise<void> }[]): Promise<void> {
    try {
      await this.storage.appendChange(change);
      this.appendsSinceSnapshot++;
      this.emit({ kind: "local-change", bytes: change });
      await Promise.all(peers.map((p) => p.send(change).catch((e) => this.emitErr(e, "send"))));
      await this.maybeSnapshot();
    } catch (e) {
      this.emitErr(e, "save");
    }
  }

  private async handleRemote(peerId: string, payload: Uint8Array): Promise<void> {
    try {
      const changed = this.store.applyChange(payload);
      if (!changed) return;
      await this.storage.appendChange(payload);
      this.appendsSinceSnapshot++;
      this.emit({ kind: "remote-change", peerId, bytes: payload });
      await this.maybeSnapshot();
    } catch (e) {
      this.emitErr(e, "apply");
    }
  }

  private async maybeSnapshot(): Promise<void> {
    if (this.appendsSinceSnapshot < this.snapshotEvery) return;
    try {
      await this.storage.saveDoc(this.store.save());
      await this.storage.truncateChanges();
      this.appendsSinceSnapshot = 0;
      this.emit({ kind: "snapshot-saved" });
    } catch (e) {
      this.emitErr(e, "save");
    }
  }

  async close(): Promise<void> {
    for (const u of this.unsubscribers) u();
    this.unsubscribers = [];
    if (this.appendsSinceSnapshot > 0) {
      await this.storage.saveDoc(this.store.save());
      await this.storage.truncateChanges();
    }
  }

  private emit(event: SyncEvent): void {
    for (const l of this.listeners) l(event);
  }

  private emitErr(e: unknown, phase: "load" | "apply" | "send" | "save"): void {
    const error = e instanceof Error ? e : new Error(String(e));
    this.emit({ kind: "error", error, phase });
  }
}
