//! Encrypted-backup file I/O (M3 / P9.5). The bytes are already sealed by the
//! front-end (`packages/core/backup.ts`, passphrase → AES-GCM) before they reach
//! here; this module only routes them through a user-driven OS file dialog.
//!
//! Narrow by construction: each command opens the dialog plugin and touches a
//! single user-chosen path via `std::fs`. No broad `fs` capability is exposed to
//! the webview (CLAUDE.md) — the path never originates in JS.

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

const FILE_NAME: &str = "todo-p2p-backup.tp2p";
const FILTER_NAME: &str = "todo-p2p backup";
const FILTER_EXT: &str = "tp2p";

/// Save sealed backup bytes to a user-chosen file. Returns `false` if the user
/// cancelled the dialog (not an error).
#[tauri::command]
pub async fn export_backup(app: AppHandle, bytes: Vec<u8>) -> Result<bool, String> {
    let Some(path) = app
        .dialog()
        .file()
        .set_file_name(FILE_NAME)
        .add_filter(FILTER_NAME, &[FILTER_EXT])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = path.into_path().map_err(|e| format!("backup path: {e}"))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("backup write failed: {e}"))?;
    Ok(true)
}

/// Read sealed backup bytes from a user-chosen file. Returns `None` if the user
/// cancelled. Decryption happens back in the front-end with the passphrase.
#[tauri::command]
pub async fn import_backup(app: AppHandle) -> Result<Option<Vec<u8>>, String> {
    let Some(path) = app
        .dialog()
        .file()
        .add_filter(FILTER_NAME, &[FILTER_EXT])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|e| format!("backup path: {e}"))?;
    let bytes = std::fs::read(&path).map_err(|e| format!("backup read failed: {e}"))?;
    Ok(Some(bytes))
}
