//! SQLCipher-backed `StorageAdapter` (E2.1). Mirrors the core
//! `packages/core/src/adapters/StorageAdapter.ts` contract behind `storage_*`
//! Tauri commands, persisting the Automerge doc snapshot, an ordered change log,
//! and the trusted-peers list. The whole DB is encrypted at rest by SQLCipher
//! with a key held in the OS keyring (`keystore::db_key`) — no plaintext todos
//! or keys ever hit disk (CLAUDE.md).
//!
//! DB logic lives in free functions over `&Connection` so it is synchronous and
//! unit-testable with a fixed key (no keyring); the `#[tauri::command]` wrappers
//! only handle locking + state, mirroring the `iroh_*` command idiom.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::{Mutex, MutexGuard};

use crate::{keystore, migrations};

const SCHEMA_SQL: &str = "\
CREATE TABLE IF NOT EXISTS doc (
  id    INTEGER PRIMARY KEY CHECK (id = 0),
  bytes BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS changes (
  seq   INTEGER PRIMARY KEY AUTOINCREMENT,
  bytes BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS trusted_peers (
  node_id      TEXT PRIMARY KEY,
  public_key   BLOB NOT NULL,
  paired_at    INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);";

/// Wire shape of a trusted peer. `#[serde(rename_all = "camelCase")]` matches the
/// core `TrustedPeer` TS type (publicKey/pairedAt/lastSeenAt); bytes cross the IPC
/// as a JSON number array, as the iroh commands already do.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrustedPeerDto {
    pub node_id: String,
    pub public_key: Vec<u8>,
    pub paired_at: i64,
    pub last_seen_at: i64,
}

// ---- DB primitives (sync, testable) --------------------------------------

/// Open (or create) the encrypted DB at `path`, unlock it with `key`, bootstrap
/// the schema, and reconcile the table-schema version. A wrong key fails here
/// when the first statement tries to decrypt.
fn open_db(path: &Path, key: &[u8; 32]) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("storage open failed: {e}"))?;
    // Raw 256-bit key as a hex blob literal — no passphrase KDF. `key` is a
    // build-time constant string here only in the sense that it is never logged.
    conn.execute_batch(&format!(
        "PRAGMA key = \"x'{}'\";\nPRAGMA cipher_memory_security = ON;",
        hex::encode(key)
    ))
    .map_err(|e| format!("storage unlock failed: {e}"))?;
    conn.execute_batch(SCHEMA_SQL)
        .map_err(|e| format!("storage schema failed (wrong key?): {e}"))?;

    let uv: i64 = conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(|e| format!("read user_version: {e}"))?;
    let current = i64::from(migrations::CURRENT_SCHEMA_VERSION);
    if uv == 0 {
        conn.pragma_update(None, "user_version", current)
            .map_err(|e| format!("set user_version: {e}"))?;
    } else if uv > current {
        return Err(format!("db schema v{uv} is newer than app v{current}"));
    }
    Ok(conn)
}

fn load_doc(conn: &Connection) -> Result<Option<Vec<u8>>, String> {
    conn.query_row("SELECT bytes FROM doc WHERE id = 0", [], |r| {
        r.get::<_, Vec<u8>>(0)
    })
    .optional()
    .map_err(|e| format!("load_doc: {e}"))
}

fn save_doc(conn: &Connection, bytes: &[u8]) -> Result<(), String> {
    conn.execute(
        "INSERT INTO doc(id, bytes) VALUES(0, ?1)
         ON CONFLICT(id) DO UPDATE SET bytes = excluded.bytes",
        params![bytes],
    )
    .map_err(|e| format!("save_doc: {e}"))?;
    Ok(())
}

fn append_change(conn: &Connection, change: &[u8]) -> Result<(), String> {
    conn.execute("INSERT INTO changes(bytes) VALUES(?1)", params![change])
        .map_err(|e| format!("append_change: {e}"))?;
    Ok(())
}

fn load_changes(conn: &Connection) -> Result<Vec<Vec<u8>>, String> {
    let mut stmt = conn
        .prepare("SELECT bytes FROM changes ORDER BY seq ASC")
        .map_err(|e| format!("load_changes prepare: {e}"))?;
    let rows = stmt
        .query_map([], |r| r.get::<_, Vec<u8>>(0))
        .map_err(|e| format!("load_changes query: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("load_changes row: {e}"))
}

fn truncate_changes(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM changes", [])
        .map_err(|e| format!("truncate_changes: {e}"))?;
    Ok(())
}

fn load_trusted_peers(conn: &Connection) -> Result<Vec<TrustedPeerDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT node_id, public_key, paired_at, last_seen_at
             FROM trusted_peers ORDER BY paired_at ASC",
        )
        .map_err(|e| format!("load_trusted_peers prepare: {e}"))?;
    let rows = stmt
        .query_map([], |r| {
            Ok(TrustedPeerDto {
                node_id: r.get(0)?,
                public_key: r.get(1)?,
                paired_at: r.get(2)?,
                last_seen_at: r.get(3)?,
            })
        })
        .map_err(|e| format!("load_trusted_peers query: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("load_trusted_peers row: {e}"))
}

fn save_trusted_peer(conn: &Connection, peer: &TrustedPeerDto) -> Result<(), String> {
    conn.execute(
        "INSERT INTO trusted_peers(node_id, public_key, paired_at, last_seen_at)
         VALUES(?1, ?2, ?3, ?4)
         ON CONFLICT(node_id) DO UPDATE SET
           public_key   = excluded.public_key,
           paired_at    = excluded.paired_at,
           last_seen_at = excluded.last_seen_at",
        params![
            peer.node_id,
            peer.public_key,
            peer.paired_at,
            peer.last_seen_at
        ],
    )
    .map_err(|e| format!("save_trusted_peer: {e}"))?;
    Ok(())
}

fn remove_trusted_peer(conn: &Connection, node_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM trusted_peers WHERE node_id = ?1",
        params![node_id],
    )
    .map_err(|e| format!("remove_trusted_peer: {e}"))?;
    Ok(())
}

/// Device wipe (M3 / P9.6): clear every row, then VACUUM so freed SQLCipher
/// pages are reclaimed (no plaintext residue lingers in the file). The DB key
/// is deliberately kept — the caller resets the identity separately — so the
/// now-empty encrypted DB still reopens on the next launch.
fn wipe(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("DELETE FROM doc; DELETE FROM changes; DELETE FROM trusted_peers; VACUUM;")
        .map_err(|e| format!("wipe: {e}"))?;
    Ok(())
}

// ---- Tauri state + commands ----------------------------------------------

/// Managed storage state. The `Connection` is `!Sync`, so it lives behind a
/// `tokio::Mutex` and is opened lazily on first command (mirroring
/// `IrohState::shared`). `db_path` is set once from the app-data dir in lib.rs
/// `.setup()`.
#[derive(Default)]
pub struct StorageState {
    conn: Mutex<Option<Connection>>,
    db_path: OnceLock<PathBuf>,
}

impl StorageState {
    /// Record the on-disk DB path. Called once during Tauri setup.
    pub fn set_db_path(&self, path: PathBuf) {
        let _ = self.db_path.set(path);
    }

    /// A guard whose `Option<Connection>` is guaranteed initialized. Opens the
    /// encrypted DB (unlocking with the keyring key) on first use.
    async fn conn(&self) -> Result<MutexGuard<'_, Option<Connection>>, String> {
        let mut guard = self.conn.lock().await;
        if guard.is_none() {
            let path = self
                .db_path
                .get()
                .ok_or_else(|| "storage path not initialized".to_string())?;
            let key = keystore::db_key()?;
            *guard = Some(open_db(path, &key)?);
        }
        Ok(guard)
    }
}

#[tauri::command]
pub async fn storage_load_doc(state: State<'_, StorageState>) -> Result<Option<Vec<u8>>, String> {
    let guard = state.conn().await?;
    let conn = guard.as_ref().expect("conn initialized");
    let Some(bytes) = load_doc(conn)? else {
        return Ok(None);
    };
    // Migrate the snapshot to the current schema on load (E2.3). Persist the
    // upgraded snapshot back, but do NOT truncate the change log — pending
    // deltas there have not been folded in, and replaying them onto a migrated
    // snapshot is safe in Automerge. Dropping them would be silent data loss.
    match migrations::migrate(&bytes)? {
        Some(migrated) => {
            save_doc(conn, &migrated)?;
            Ok(Some(migrated))
        }
        None => Ok(Some(bytes)),
    }
}

#[tauri::command]
pub async fn storage_save_doc(
    state: State<'_, StorageState>,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let guard = state.conn().await?;
    save_doc(guard.as_ref().expect("conn initialized"), &bytes)
}

#[tauri::command]
pub async fn storage_append_change(
    state: State<'_, StorageState>,
    change: Vec<u8>,
) -> Result<(), String> {
    let guard = state.conn().await?;
    append_change(guard.as_ref().expect("conn initialized"), &change)
}

#[tauri::command]
pub async fn storage_load_changes(state: State<'_, StorageState>) -> Result<Vec<Vec<u8>>, String> {
    let guard = state.conn().await?;
    load_changes(guard.as_ref().expect("conn initialized"))
}

#[tauri::command]
pub async fn storage_truncate_changes(state: State<'_, StorageState>) -> Result<(), String> {
    let guard = state.conn().await?;
    truncate_changes(guard.as_ref().expect("conn initialized"))
}

#[tauri::command]
pub async fn storage_load_trusted_peers(
    state: State<'_, StorageState>,
) -> Result<Vec<TrustedPeerDto>, String> {
    let guard = state.conn().await?;
    load_trusted_peers(guard.as_ref().expect("conn initialized"))
}

#[tauri::command]
pub async fn storage_save_trusted_peer(
    state: State<'_, StorageState>,
    peer: TrustedPeerDto,
) -> Result<(), String> {
    let guard = state.conn().await?;
    save_trusted_peer(guard.as_ref().expect("conn initialized"), &peer)
}

#[tauri::command]
pub async fn storage_remove_trusted_peer(
    state: State<'_, StorageState>,
    node_id: String,
) -> Result<(), String> {
    let guard = state.conn().await?;
    remove_trusted_peer(guard.as_ref().expect("conn initialized"), &node_id)
}

/// Device wipe (M3 / P9.6). Clears all persisted data and deletes the iroh
/// device secret so the next launch mints a fresh NodeId — a brand-new identity.
/// The SQLCipher key is kept so the now-empty DB reopens; the front-end reloads
/// into a first-run state afterwards. Destructive + irreversible (no recovery).
#[tauri::command]
pub async fn storage_wipe(state: State<'_, StorageState>) -> Result<(), String> {
    let guard = state.conn().await?;
    wipe(guard.as_ref().expect("conn initialized"))?;
    // New identity on next launch: drop the iroh secret (regenerated lazily).
    keystore::delete(keystore::IROH_SECRET)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    const KEY: [u8; 32] = [7u8; 32];

    fn fresh() -> (TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let conn = open_db(&dir.path().join("todo.db"), &KEY).unwrap();
        (dir, conn)
    }

    fn sample_peer() -> TrustedPeerDto {
        TrustedPeerDto {
            node_id: "node-abc".into(),
            public_key: vec![9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
            paired_at: 1_715_000_000_000,
            last_seen_at: 1_715_000_001_000,
        }
    }

    // ---- contract.ts parity ----

    #[test]
    fn load_doc_on_empty_returns_none() {
        let (_d, conn) = fresh();
        assert_eq!(load_doc(&conn).unwrap(), None);
    }

    #[test]
    fn save_then_load_roundtrips_bytes() {
        let (_d, conn) = fresh();
        let bytes = vec![1, 2, 3, 4, 255];
        save_doc(&conn, &bytes).unwrap();
        assert_eq!(load_doc(&conn).unwrap(), Some(bytes));
    }

    #[test]
    fn append_then_load_changes_preserves_order() {
        let (_d, conn) = fresh();
        append_change(&conn, &[1]).unwrap();
        append_change(&conn, &[2, 3]).unwrap();
        append_change(&conn, &[4]).unwrap();
        assert_eq!(
            load_changes(&conn).unwrap(),
            vec![vec![1u8], vec![2, 3], vec![4]]
        );
    }

    #[test]
    fn truncate_changes_empties_log() {
        let (_d, conn) = fresh();
        append_change(&conn, &[1]).unwrap();
        append_change(&conn, &[2]).unwrap();
        truncate_changes(&conn).unwrap();
        assert!(load_changes(&conn).unwrap().is_empty());
    }

    #[test]
    fn save_doc_replaces_not_appends() {
        let (_d, conn) = fresh();
        save_doc(&conn, &[1, 1]).unwrap();
        save_doc(&conn, &[2, 2, 2]).unwrap();
        assert_eq!(load_doc(&conn).unwrap(), Some(vec![2, 2, 2]));
    }

    #[test]
    fn trusted_peers_save_list_remove_roundtrip() {
        let (_d, conn) = fresh();
        assert!(load_trusted_peers(&conn).unwrap().is_empty());
        let peer = sample_peer();
        save_trusted_peer(&conn, &peer).unwrap();
        let list = load_trusted_peers(&conn).unwrap();
        assert_eq!(list, vec![peer.clone()]);
        // upsert (no duplicate row), updated timestamp
        let mut updated = peer.clone();
        updated.last_seen_at = 1_715_000_009_999;
        save_trusted_peer(&conn, &updated).unwrap();
        let list = load_trusted_peers(&conn).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].last_seen_at, 1_715_000_009_999);

        remove_trusted_peer(&conn, "node-abc").unwrap();
        assert!(load_trusted_peers(&conn).unwrap().is_empty());
    }

    #[test]
    fn wipe_clears_all_tables() {
        let (_d, conn) = fresh();
        save_doc(&conn, &[1, 2, 3]).unwrap();
        append_change(&conn, &[4]).unwrap();
        append_change(&conn, &[5]).unwrap();
        save_trusted_peer(&conn, &sample_peer()).unwrap();

        wipe(&conn).unwrap();

        assert_eq!(load_doc(&conn).unwrap(), None);
        assert!(load_changes(&conn).unwrap().is_empty());
        assert!(load_trusted_peers(&conn).unwrap().is_empty());
    }

    // ---- integration: persist + reload across a simulated restart ----

    #[test]
    fn persists_across_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("todo.db");

        // Replay the SyncEngine.open call pattern: snapshot + change log + peer.
        {
            let conn = open_db(&path, &KEY).unwrap();
            assert_eq!(load_doc(&conn).unwrap(), None);
            save_doc(&conn, &[10, 20, 30]).unwrap();
            append_change(&conn, &[1]).unwrap();
            append_change(&conn, &[2]).unwrap();
            save_trusted_peer(&conn, &sample_peer()).unwrap();
        } // drop connection == app quit

        // Reopen with the same key == app relaunch.
        let conn = open_db(&path, &KEY).unwrap();
        assert_eq!(load_doc(&conn).unwrap(), Some(vec![10, 20, 30]));
        assert_eq!(load_changes(&conn).unwrap(), vec![vec![1u8], vec![2]]);
        assert_eq!(load_trusted_peers(&conn).unwrap().len(), 1);
    }

    #[test]
    fn wrong_key_fails_to_open() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("todo.db");
        {
            let conn = open_db(&path, &KEY).unwrap();
            save_doc(&conn, &[1, 2, 3]).unwrap();
        }
        // A different key must not decrypt the existing DB.
        let wrong = open_db(&path, &[9u8; 32]);
        assert!(wrong.is_err(), "wrong key must fail to open encrypted db");
    }
}
