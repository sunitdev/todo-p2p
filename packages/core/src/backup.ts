/**
 * Encrypted backup codec (M3 / P9.5). Produces a *portable*, user-managed
 * recovery file from an Automerge document snapshot.
 *
 * The at-rest device key is a non-extractable CryptoKey, so it cannot encrypt a
 * file that restores onto a *different* (or wiped) device. A backup is therefore
 * sealed with a key derived from a user passphrase — the only secret that can
 * cross device boundaries. Lose the passphrase = lose the backup; there is no
 * recovery (CLAUDE.md). The file never auto-uploads — callers hand it to the OS.
 *
 * Uses only WebCrypto + standard globals (like `pairing.ts`), so it stays pure
 * and runs identically in the browser, the Tauri webview, and Bun under test.
 *
 * File layout (all integers big-endian):
 *   [magic "TODOP2PB" (8)][version (1)][iterations (4)][salt (16)][iv (12)][AES-GCM ciphertext+tag]
 */

const MAGIC = new TextEncoder().encode("TODOP2PB");
const VERSION = 1;
const PBKDF2_ITERATIONS = 600_000;
const SALT_LEN = 16;
const IV_LEN = 12;
const HEADER_LEN = MAGIC.length + 1 + 4 + SALT_LEN + IV_LEN; // 8+1+4+16+12 = 41

/** Thrown when a backup file is malformed, the wrong version, or undecryptable. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

/** Seal an Automerge snapshot into a passphrase-encrypted backup file. */
export async function encryptBackup(
  snapshot: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  if (passphrase.length === 0) throw new BackupError("passphrase must not be empty");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, snapshot),
  );

  const out = new Uint8Array(HEADER_LEN + ct.length);
  const view = new DataView(out.buffer);
  let off = 0;
  out.set(MAGIC, off);
  off += MAGIC.length;
  out[off] = VERSION;
  off += 1;
  view.setUint32(off, PBKDF2_ITERATIONS, false);
  off += 4;
  out.set(salt, off);
  off += SALT_LEN;
  out.set(iv, off);
  off += IV_LEN;
  out.set(ct, off);
  return out;
}

/**
 * Open a backup file with its passphrase, returning the Automerge snapshot.
 * A wrong passphrase or any tampering fails the AES-GCM auth tag and throws
 * `BackupError` — indistinguishable on purpose (no oracle).
 */
export async function decryptBackup(file: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (file.length < HEADER_LEN) throw new BackupError("backup file is truncated");
  if (!eq(file.subarray(0, MAGIC.length), MAGIC)) {
    throw new BackupError("not a todo-p2p backup file");
  }
  let off = MAGIC.length;
  const version = file[off];
  off += 1;
  if (version !== VERSION) throw new BackupError(`unsupported backup version ${version}`);
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const iterations = view.getUint32(off, false);
  off += 4;
  const salt = file.subarray(off, off + SALT_LEN);
  off += SALT_LEN;
  const iv = file.subarray(off, off + IV_LEN);
  off += IV_LEN;
  const ct = file.subarray(off);

  const key = await deriveKey(passphrase, salt, iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new Uint8Array(plain);
  } catch {
    throw new BackupError("wrong passphrase or corrupted backup");
  }
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
