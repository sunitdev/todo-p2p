//! todo-p2p desktop backend.
//!
//! `main.rs` is a thin shim; all wiring lives here so integration tests can
//! compile against the lib crate. M1 adds the iroh transport (`iroh` module)
//! behind `iroh_*` Tauri commands.

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub mod backup;
pub mod iroh;
pub mod keystore;
pub mod migrations;
pub mod storage;

/// Phase 5: global shortcut for Quick Entry. macOS uses Cmd+Space (matches
/// Things3); Windows/Linux use Ctrl+Space. Bound at startup; if registration
/// fails (another app already owns the binding), we log + continue — the
/// window-focused fallback in `useShortcut('Space', { meta: true })` still
/// works inside the app window.
fn quick_entry_shortcut() -> Shortcut {
    #[cfg(target_os = "macos")]
    let mods = Modifiers::SUPER;
    #[cfg(not(target_os = "macos"))]
    let mods = Modifiers::CONTROL;
    Shortcut::new(Some(mods), Code::Space)
}

/// Payload for the `bridge-error` event (M4 E4.4): an OS-level wiring failure the
/// front-end surfaces as a toast instead of letting it die in stderr. Pure so it
/// is unit-testable without a running app.
pub(crate) fn bridge_error_payload(kind: &str, message: &str) -> serde_json::Value {
    serde_json::json!({ "kind": kind, "message": message })
}

/// Build and run the Tauri application. Called by `main.rs`.
pub fn run() {
    let shortcut = quick_entry_shortcut();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, triggered, event| {
                    // Fire on key-down only; the plugin fires twice (down + up)
                    // by default and we don't want duplicate panel toggles.
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if triggered == &shortcut {
                        // Best-effort emit — the front-end may not be mounted
                        // yet during early startup; failures are logged then
                        // dropped (no user-facing surface for global hotkeys).
                        if let Err(e) = app.emit("quick-entry-open", ()) {
                            eprintln!("[quick-entry] failed to emit event: {e}");
                        }
                    }
                })
                .build(),
        )
        .manage(iroh::IrohState::default())
        .manage(storage::StorageState::default())
        .invoke_handler(tauri::generate_handler![
            iroh::iroh_start,
            iroh::iroh_stop,
            iroh::iroh_mint_pairing_ticket,
            iroh::iroh_dial_with_ticket,
            iroh::iroh_dial_trusted,
            iroh::iroh_send,
            iroh::iroh_close_peer,
            iroh::iroh_subscribe,
            storage::storage_load_doc,
            storage::storage_save_doc,
            storage::storage_append_change,
            storage::storage_load_changes,
            storage::storage_truncate_changes,
            storage::storage_load_trusted_peers,
            storage::storage_save_trusted_peer,
            storage::storage_remove_trusted_peer,
            storage::storage_wipe,
            backup::export_backup,
            backup::import_backup,
        ])
        .setup(|app| {
            // Resolve the encrypted DB path under the OS app-data dir and hand it
            // to the storage state (the connection opens lazily on first command,
            // unlocking with the keyring key). Best-effort dir create; failures go
            // to stderr, never to the user.
            match app.path().app_data_dir() {
                Ok(dir) => {
                    if let Err(e) = std::fs::create_dir_all(&dir) {
                        eprintln!("[storage] failed to create app data dir: {e}");
                    }
                    app.state::<storage::StorageState>()
                        .set_db_path(dir.join("todo.db"));
                }
                Err(e) => eprintln!("[storage] app data dir unavailable: {e}"),
            }

            // Register the shortcut after the plugin is installed. A failure
            // here typically means another running app already owns the combo.
            // M4 E4.4: besides the stderr log, emit `bridge-error` so the UI can
            // toast it; the window-focused fallback continues to work regardless.
            // The emit is deferred — the webview isn't subscribed yet at setup —
            // so it lands once the front-end's listener is up.
            let shortcut = quick_entry_shortcut();
            if let Err(e) = app.global_shortcut().register(shortcut) {
                let msg = format!("global shortcut registration failed: {e}");
                eprintln!("[quick-entry] {msg}");
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                    let _ = handle.emit(
                        "bridge-error",
                        bridge_error_payload("shortcut-register", &msg),
                    );
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::bridge_error_payload;

    #[test]
    fn bridge_error_payload_has_kind_and_message() {
        let v = bridge_error_payload("shortcut-register", "boom");
        assert_eq!(v["kind"], "shortcut-register");
        assert_eq!(v["message"], "boom");
        // Object shape the front-end's `listen<{kind, message}>` expects.
        assert!(v.is_object());
    }
}
