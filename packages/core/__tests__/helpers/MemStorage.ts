import type { StorageAdapter, TrustedPeer } from "../../src/adapters/index.ts";

/** In-memory StorageAdapter for tests. Tracks call counts for spy-style assertions. */
export class MemStorage implements StorageAdapter {
  doc: Uint8Array | null = null;
  changes: Uint8Array[] = [];
  peers = new Map<string, TrustedPeer>();

  saveDocCalls = 0;
  truncateCalls = 0;
  appendCalls = 0;

  /** When set, the next call to the named method rejects with this error (then clears). */
  failNext: Partial<Record<"saveDoc" | "appendChange" | "loadDoc" | "loadChanges", Error>> = {};

  async loadDoc() {
    if (this.failNext.loadDoc) {
      const e = this.failNext.loadDoc;
      delete this.failNext.loadDoc;
      throw e;
    }
    return this.doc;
  }
  async saveDoc(b: Uint8Array) {
    this.saveDocCalls++;
    if (this.failNext.saveDoc) {
      const e = this.failNext.saveDoc;
      delete this.failNext.saveDoc;
      throw e;
    }
    this.doc = b;
  }
  async appendChange(c: Uint8Array) {
    this.appendCalls++;
    if (this.failNext.appendChange) {
      const e = this.failNext.appendChange;
      delete this.failNext.appendChange;
      throw e;
    }
    this.changes.push(c);
  }
  async loadChanges() {
    if (this.failNext.loadChanges) {
      const e = this.failNext.loadChanges;
      delete this.failNext.loadChanges;
      throw e;
    }
    return [...this.changes];
  }
  async truncateChanges() {
    this.truncateCalls++;
    this.changes = [];
  }
  async loadTrustedPeers() {
    return [...this.peers.values()];
  }
  async saveTrustedPeer(p: TrustedPeer) {
    this.peers.set(p.nodeId, p);
  }
  async removeTrustedPeer(id: string) {
    this.peers.delete(id);
  }
}
