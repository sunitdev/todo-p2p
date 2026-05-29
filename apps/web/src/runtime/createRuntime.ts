import type { StorageAdapter, TransportAdapter } from '@todo-p2p/core/adapters';
import { WebStorageAdapter } from '../storage/webStorage';
import { TauriStorageAdapter } from './tauriStorage';
import { NullTransport } from './nullTransport';
import { IrohWebTransport } from './irohWebTransport';
import { IrohTauriTransport } from './irohTauriTransport';
import { hasWebTransport, isTauri } from './env';

export interface Runtime {
  storage: StorageAdapter;
  transport: TransportAdapter;
}

/**
 * Realizes the platform's adapters and wires runtime selection. Storage is
 * selected by host:
 *   - Tauri  → `TauriStorageAdapter` (native SQLCipher in Rust, key in the OS
 *              keyring — M2).
 *   - Web    → `WebStorageAdapter` (OPFS + AES-GCM, key in non-extractable
 *              WebCrypto).
 * Transport is selected by host:
 *   - Tauri  → `IrohTauriTransport` (iroh runs natively in Rust). No fallback:
 *              a transport failure here is a real error, surfaced by the caller.
 *   - Web    → `IrohWebTransport` (iroh-js WASM in a Worker). If the WASM module
 *              cannot initialize we fall back to `NullTransport` — a working
 *              single-device app, never a weaker *transport* (CLAUDE.md).
 */
export async function createRuntime(): Promise<Runtime> {
  const storage = isTauri() ? await TauriStorageAdapter.open() : await WebStorageAdapter.open();
  const transport = await selectTransport();
  return { storage, transport };
}

async function selectTransport(): Promise<TransportAdapter> {
  if (isTauri()) {
    return IrohTauriTransport.open();
  }
  if (hasWebTransport()) {
    try {
      return await IrohWebTransport.open();
    } catch (e) {
      console.warn('[runtime] web iroh transport unavailable — running single-device:', e);
      return new NullTransport();
    }
  }
  // App routes the no-WebTransport / no-Tauri case to Unsupported before this.
  return new NullTransport();
}
