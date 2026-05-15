#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // TODO: register iroh_* commands (pairing, sync) once implemented
        // TODO: register storage_* commands (SQLCipher access) once implemented
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
