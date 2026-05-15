import type { StorageAdapter, TrustedPeer } from '@todo-p2p/core/adapters';
import { WebSecureKeyStore } from './webKeyStore';

const DOC_FILE = 'doc.bin';
const CHANGES_FILE = 'changes.log';
const PEERS_FILE = 'peers.json';
const IV_LEN = 12;

/**
 * OPFS-backed StorageAdapter for web. All on-disk blobs are sealed with AES-GCM
 * using a non-extractable CryptoKey from WebSecureKeyStore.
 *
 * On-disk format:
 *   doc.bin      = [iv:12][ciphertext+tag]
 *   changes.log  = concat of [len:4 BE][iv:12][ciphertext+tag] records
 *   peers.json   = [iv:12][ciphertext+tag] over UTF-8 JSON
 */
export class WebStorageAdapter implements StorageAdapter {
  private constructor(
    private readonly root: FileSystemDirectoryHandle,
    private readonly key: CryptoKey,
  ) {}

  static async open(): Promise<WebStorageAdapter> {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      throw new Error('OPFS unsupported — this browser cannot persist data securely');
    }
    const root = await navigator.storage.getDirectory();
    const keyStore = await WebSecureKeyStore.open();
    const key = await keyStore.docKey();
    return new WebStorageAdapter(root, key);
  }

  async loadDoc(): Promise<Uint8Array | null> {
    const bytes = await this.readFile(DOC_FILE);
    if (!bytes) return null;
    return this.open_(bytes);
  }

  async saveDoc(bytes: Uint8Array): Promise<void> {
    const sealed = await this.seal(bytes);
    await this.writeFile(DOC_FILE, sealed);
  }

  async appendChange(change: Uint8Array): Promise<void> {
    const sealed = await this.seal(change);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, sealed.length, false);
    const record = concat(len, sealed);
    await this.appendFile(CHANGES_FILE, record);
  }

  async loadChanges(): Promise<Uint8Array[]> {
    const bytes = await this.readFile(CHANGES_FILE);
    if (!bytes || bytes.length === 0) return [];
    const out: Uint8Array[] = [];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let off = 0;
    while (off + 4 <= bytes.length) {
      const len = view.getUint32(off, false);
      off += 4;
      if (off + len > bytes.length) break;
      const sealed = bytes.subarray(off, off + len);
      off += len;
      out.push(await this.open_(sealed));
    }
    return out;
  }

  async truncateChanges(): Promise<void> {
    await this.deleteFile(CHANGES_FILE);
  }

  async loadTrustedPeers(): Promise<TrustedPeer[]> {
    const bytes = await this.readFile(PEERS_FILE);
    if (!bytes) return [];
    const plain = await this.open_(bytes);
    const raw = JSON.parse(new TextDecoder().decode(plain)) as SerialPeer[];
    return raw.map(deserializePeer);
  }

  async saveTrustedPeer(peer: TrustedPeer): Promise<void> {
    const current = await this.loadTrustedPeers();
    const next = [...current.filter((p) => p.nodeId !== peer.nodeId), peer];
    await this.writePeers(next);
  }

  async removeTrustedPeer(nodeId: string): Promise<void> {
    const current = await this.loadTrustedPeers();
    await this.writePeers(current.filter((p) => p.nodeId !== nodeId));
  }

  private async writePeers(peers: TrustedPeer[]): Promise<void> {
    const json = JSON.stringify(peers.map(serializePeer));
    const sealed = await this.seal(new TextEncoder().encode(json));
    await this.writeFile(PEERS_FILE, sealed);
  }

  private async seal(plain: Uint8Array): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, plain),
    );
    return concat(iv, ct);
  }

  private async open_(sealed: Uint8Array): Promise<Uint8Array> {
    if (sealed.length < IV_LEN) throw new Error('sealed blob too short');
    const iv = sealed.subarray(0, IV_LEN);
    const ct = sealed.subarray(IV_LEN);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.key, ct);
    return new Uint8Array(plain);
  }

  private async readFile(name: string): Promise<Uint8Array | null> {
    try {
      const handle = await this.root.getFileHandle(name);
      const file = await handle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  private async writeFile(name: string, bytes: Uint8Array): Promise<void> {
    const handle = await this.root.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
  }

  private async appendFile(name: string, bytes: Uint8Array): Promise<void> {
    const handle = await this.root.getFileHandle(name, { create: true });
    const file = await handle.getFile();
    const writable = await handle.createWritable({ keepExistingData: true });
    await writable.write({ type: 'write', position: file.size, data: bytes });
    await writable.close();
  }

  private async deleteFile(name: string): Promise<void> {
    try {
      await this.root.removeEntry(name);
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }
}

interface SerialPeer {
  nodeId: string;
  publicKey: string;
  pairedAt: number;
  lastSeenAt: number;
}

function serializePeer(p: TrustedPeer): SerialPeer {
  return { ...p, publicKey: bytesToB64(p.publicKey) };
}

function deserializePeer(p: SerialPeer): TrustedPeer {
  return { ...p, publicKey: b64ToBytes(p.publicKey) };
}

function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return btoa(s);
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function isNotFound(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'NotFoundError';
}
