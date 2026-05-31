import { isTauri } from './env';

/**
 * Platform file I/O for encrypted backups (M3 / P9.5). The bytes handed in are
 * already sealed (passphrase → AES-GCM, `@todo-p2p/core` backup codec); this
 * only moves them to/from a user-chosen file:
 *   - desktop → Rust `export_backup` / `import_backup` commands (native dialog).
 *   - web     → Blob download / hidden `<input type=file>`.
 */

const BACKUP_FILENAME = 'todo-p2p-backup.tp2p';

/** Save sealed bytes to disk. Returns false if the user cancelled. */
export async function saveBackupFile(bytes: Uint8Array): Promise<boolean> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<boolean>('export_backup', { bytes: Array.from(bytes) });
  }
  return downloadBlob(bytes, BACKUP_FILENAME);
}

/** Read sealed bytes from a user-chosen file. Returns null if cancelled. */
export async function openBackupFile(): Promise<Uint8Array | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<number[] | null>('import_backup');
    return bytes === null ? null : Uint8Array.from(bytes);
  }
  return pickFile();
}

function downloadBlob(bytes: Uint8Array, filename: string): boolean {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

function pickFile(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tp2p';
    // Resolve null if the dialog is dismissed without a selection.
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.addEventListener(
      'change',
      async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        resolve(new Uint8Array(await file.arrayBuffer()));
      },
      { once: true },
    );
    input.click();
  });
}
