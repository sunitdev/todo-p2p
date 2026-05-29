//! todo-p2p desktop backend.
//!
//! `main.rs` is a thin shim; all wiring lives here so integration tests can
//! compile against the lib crate. M1 adds the iroh transport (`iroh` module)
//! behind `iroh_*` Tauri commands.

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

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
            // here typically means another running app already owns the combo —
            // we surface the error to stderr (never to the user) and let the
            // window-focused fallback continue to work.
            let shortcut = quick_entry_shortcut();
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("[quick-entry] global shortcut registration failed: {e}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
