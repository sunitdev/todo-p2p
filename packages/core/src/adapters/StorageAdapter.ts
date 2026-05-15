/**
 * Persists encrypted Automerge document bytes and trusted-peers metadata.
 * Implementations: rusqlite+SQLCipher (desktop), op-sqlite+SQLCipher (mobile),
 * wa-sqlite+OPFS+AES-GCM (web).
 *
 * The adapter is responsible for at-rest encryption — Core hands it plaintext
 * Automerge bytes and trusts the adapter + SecureKeyStore to seal them.
 */
export interface StorageAdapter {
  /** Load the persisted Automerge document, or null if first run. */
  loadDoc(): Promise<Uint8Array | null>;
  /** Replace the persisted Automerge document atomically. */
  saveDoc(bytes: Uint8Array): Promise<void>;

  /** Append an Automerge change (incremental save). */
  appendChange(change: Uint8Array): Promise<void>;
  /** Read all appended changes since last full save (for fast startup). */
  loadChanges(): Promise<Uint8Array[]>;
  /** After a full saveDoc, the change log can be truncated. */
  truncateChanges(): Promise<void>;

  /** Trusted peers list (peer node id -> last-seen timestamp). */
  loadTrustedPeers(): Promise<TrustedPeer[]>;
  saveTrustedPeer(peer: TrustedPeer): Promise<void>;
  removeTrustedPeer(nodeId: string): Promise<void>;
}

export interface TrustedPeer {
  nodeId: string;
  publicKey: Uint8Array;
  pairedAt: number;
  lastSeenAt: number;
}
