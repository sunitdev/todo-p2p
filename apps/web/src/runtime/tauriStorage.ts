import type { StorageAdapter, TrustedPeer } from '@todo-p2p/core/adapters';

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/** Wire shape of a trusted peer over the IPC (bytes as JSON number[]). */
interface TrustedPeerDto {
  nodeId: string;
  publicKey: number[];
  pairedAt: number;
  lastSeenAt: number;
}

/**
 * Desktop `StorageAdapter`: persistence runs natively in Rust (SQLCipher); this
 * proxies to the `storage_*` Tauri commands. The DB is encrypted at rest with a
 * key from the OS keyring — no plaintext ever crosses to the webview's own disk.
 * Tauri v2 converts camelCase JS argument keys to the snake_case Rust params;
 * binary crosses as JSON `number[]` (sent via `Array.from`, read via
 * `Uint8Array.from`), exactly as the iroh transport does.
 */
export class TauriStorageAdapter implements StorageAdapter {
  // Injectable so tests can drive it with a mock invoke (no Tauri runtime).
  private constructor(private readonly invoke: Invoke) {}

  static async open(): Promise<TauriStorageAdapter> {
    const core = await import('@tauri-apps/api/core');
    return new TauriStorageAdapter(core.invoke as Invoke);
  }

  /** Visible for testing: build an adapter over a supplied invoke fn. */
  static withInvoke(invoke: Invoke): TauriStorageAdapter {
    return new TauriStorageAdapter(invoke);
  }

  async loadDoc(): Promise<Uint8Array | null> {
    const bytes = await this.invoke<number[] | null>('storage_load_doc');
    return bytes === null ? null : Uint8Array.from(bytes);
  }

  async saveDoc(bytes: Uint8Array): Promise<void> {
    await this.invoke('storage_save_doc', { bytes: Array.from(bytes) });
  }

  async appendChange(change: Uint8Array): Promise<void> {
    await this.invoke('storage_append_change', { change: Array.from(change) });
  }

  async loadChanges(): Promise<Uint8Array[]> {
    const changes = await this.invoke<number[][]>('storage_load_changes');
    return changes.map((c) => Uint8Array.from(c));
  }

  async truncateChanges(): Promise<void> {
    await this.invoke('storage_truncate_changes');
  }

  async loadTrustedPeers(): Promise<TrustedPeer[]> {
    const peers = await this.invoke<TrustedPeerDto[]>('storage_load_trusted_peers');
    return peers.map((p) => ({
      nodeId: p.nodeId,
      publicKey: Uint8Array.from(p.publicKey),
      pairedAt: p.pairedAt,
      lastSeenAt: p.lastSeenAt,
    }));
  }

  async saveTrustedPeer(peer: TrustedPeer): Promise<void> {
    const dto: TrustedPeerDto = {
      nodeId: peer.nodeId,
      publicKey: Array.from(peer.publicKey),
      pairedAt: peer.pairedAt,
      lastSeenAt: peer.lastSeenAt,
    };
    await this.invoke('storage_save_trusted_peer', { peer: dto });
  }

  async removeTrustedPeer(nodeId: string): Promise<void> {
    await this.invoke('storage_remove_trusted_peer', { nodeId });
  }
}
