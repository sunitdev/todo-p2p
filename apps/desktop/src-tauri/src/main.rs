#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

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

fn main() {
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
        .setup(|app| {
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
