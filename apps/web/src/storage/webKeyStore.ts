import type { SecureKeyStore } from '@todo-p2p/core/adapters';

const DB_NAME = 'todo-p2p-keys';
const DB_VERSION = 1;
const STORE = 'keys';
const DOC_KEY_ID = 'doc-aead';

/**
 * Web SecureKeyStore. The AEAD key is a non-extractable CryptoKey persisted
 * inside IndexedDB. IDB serializes CryptoKey safely without exposing raw bytes
 * (structured clone of CryptoKey keeps it non-extractable). Raw bytes never
 * cross the JS boundary, satisfying the "never read/export raw key" rule.
 *
 * Implements the SecureKeyStore interface but only the symbolic key id
 * (DOC_KEY_ID) is used by the storage adapter; arbitrary set/get for byte
 * material is intentionally not supported on web — callers should use the
 * `docKey()` helper.
 */
export class WebSecureKeyStore implements SecureKeyStore {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(): Promise<WebSecureKeyStore> {
    const db = await openDb();
    return new WebSecureKeyStore(db);
  }

  async set(): Promise<void> {
    throw new Error('WebSecureKeyStore.set unsupported — use docKey()');
  }

  async get(): Promise<Uint8Array | null> {
    throw new Error('WebSecureKeyStore.get unsupported — raw key bytes are not extractable');
  }

  async delete(key: string): Promise<void> {
    await idbDelete(this.db, key);
  }

  async isHardwareBacked(): Promise<boolean> {
    return false;
  }

  /** Returns the AEAD CryptoKey, generating + persisting it on first use. */
  async docKey(): Promise<CryptoKey> {
    const existing = await idbGet<CryptoKey>(this.db, DOC_KEY_ID);
    if (existing) return existing;
    const fresh = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    await idbPut(this.db, DOC_KEY_ID, fresh);
    return fresh;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
