//! OS keyring (E2.2). Holds the 32-byte SQLCipher database key and the iroh
//! device `SecretKey`, backed by Keychain (mac) / Credential Manager (win) /
//! Secret Service (linux).
//!
//! Raw key material is generated with `OsRng`, persisted in the platform secret
//! store, and handed only to the in-process `storage`/`iroh` modules. It is
//! never exposed over a Tauri command, never written to disk in the clear, and
//! never logged (CLAUDE.md). There is deliberately no `keystore_*` command — the
//! key cannot be read or exported from the webview.

use keyring::{Entry, Error as KeyringError};
use rand::RngCore;

const SERVICE: &str = "com.todop2p.desktop";

/// Secret store keys. Exposed so M3 device-wipe can enumerate them.
pub const DB_KEY: &str = "db-key";
pub const IROH_SECRET: &str = "iroh-secret";

/// Load the 32-byte secret stored on `entry`, generating + persisting a fresh
/// one on first use. Split from [`load_or_create`] so tests can drive it with a
/// single mock `Entry` (the in-memory mock persists state per-`Entry`).
fn load_or_create_in(entry: &Entry) -> Result<[u8; 32], String> {
    match entry.get_secret() {
        Ok(bytes) => bytes
            .as_slice()
            .try_into()
            .map_err(|_| "keyring secret has unexpected length".to_string()),
        Err(KeyringError::NoEntry) => {
            let mut key = [0u8; 32];
            rand::rngs::OsRng.fill_bytes(&mut key);
            entry
                .set_secret(&key)
                .map_err(|e| format!("keyring store failed: {e}"))?;
            Ok(key)
        }
        Err(e) => Err(format!("keyring read failed: {e}")),
    }
}

fn load_or_create(name: &str) -> Result<[u8; 32], String> {
    let entry = Entry::new(SERVICE, name).map_err(|e| format!("keyring entry failed: {e}"))?;
    load_or_create_in(&entry)
}

/// SQLCipher database key. Stable for the life of the install.
pub fn db_key() -> Result<[u8; 32], String> {
    load_or_create(DB_KEY)
}

/// iroh device secret-key bytes — gives the device a stable NodeId across
/// restarts so trusted-peer reconnect works.
pub fn iroh_secret() -> Result<[u8; 32], String> {
    load_or_create(IROH_SECRET)
}

/// Remove a stored secret (M3 device-wipe). No-op if already absent.
pub fn delete(name: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, name).map_err(|e| format!("keyring entry failed: {e}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete failed: {e}")),
    }
}

/// Honest per CLAUDE.md: Keychain / Credential Manager / Secret Service are
/// software credential stores, not Secure Enclave / TPM. No hardware key in use.
pub fn is_hardware_backed() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use keyring::{mock, set_default_credential_builder};
    use std::sync::Once;

    static MOCK: Once = Once::new();
    fn use_mock() {
        // Process-global; set once. Each `Entry::new` then yields an independent
        // in-memory credential that persists state for its own lifetime.
        MOCK.call_once(|| set_default_credential_builder(mock::default_credential_builder()));
    }

    #[test]
    fn generates_then_returns_same_secret() {
        use_mock();
        let entry = Entry::new(SERVICE, "test-stable").unwrap();
        let first = load_or_create_in(&entry).unwrap();
        let second = load_or_create_in(&entry).unwrap();
        assert_eq!(first, second, "second load returns the persisted key");
        assert_ne!(first, [0u8; 32], "key is not all-zero");
    }

    #[test]
    fn delete_then_regenerate_yields_new_secret() {
        use_mock();
        let entry = Entry::new(SERVICE, "test-wipe").unwrap();
        let original = load_or_create_in(&entry).unwrap();
        entry.delete_credential().unwrap();
        let regenerated = load_or_create_in(&entry).unwrap();
        assert_ne!(original, regenerated, "post-wipe key is freshly generated");
    }

    #[test]
    fn delete_absent_is_ok() {
        use_mock();
        // delete() builds its own Entry; with the mock that entry starts empty,
        // exercising the NoEntry branch.
        assert!(delete("never-created").is_ok());
    }

    #[test]
    fn not_hardware_backed() {
        assert!(!is_hardware_backed());
    }
}
