/**
 * Platform secret store. Wraps Keychain / Credential Manager / Secret Service /
 * Android Keystore on native; non-extractable WebCrypto keys + IndexedDB on web.
 *
 * Core never sees raw key material — it only asks the store to seal/unseal blobs
 * (e.g. the SQLCipher database key or the device's Ed25519 private key).
 */
export interface SecureKeyStore {
  /** Store a secret under `key`, replacing any existing value. */
  set(key: string, value: Uint8Array): Promise<void>;
  /** Retrieve a secret, or null if not present. */
  get(key: string): Promise<Uint8Array | null>;
  /** Remove a secret. */
  delete(key: string): Promise<void>;
  /** True if the underlying store is hardware-backed (Secure Enclave, TPM, etc). */
  isHardwareBacked(): Promise<boolean>;
}
