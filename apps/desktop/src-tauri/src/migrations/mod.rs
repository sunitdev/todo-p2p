//! Rust mirror of the doc-schema migrations in
//! `packages/core/src/migrations/index.ts` (E2.3). Desktop runs these on load
//! (see `storage::storage_load_doc`) so an old on-disk doc is brought to the
//! current schema natively, exactly as the TS `migrate()` does on the web.
//!
//! Each version is one Automerge change, mirroring the TS loop. We do NOT pin a
//! fixed actor id: `Automerge::load` assigns a fresh random actor (as the JS
//! `Automerge.load` does), so when desktop and another device migrate the same
//! doc independently their create-if-absent changes merge convergently. A fixed
//! actor shared across installs would violate Automerge's per-actor ordering.
//!
//! Parity with TS is guarded two ways: `schema_version_matches_typescript`
//! fails the build if the TS `CURRENT_SCHEMA_VERSION` drifts from the constant
//! below, and the migration unit tests run against the same JS-saved fixtures.

use automerge::transaction::Transactable;
use automerge::{Automerge, ObjType, ReadDoc, Value, ROOT};

/// Must equal `CURRENT_SCHEMA_VERSION` in packages/core/src/migrations/index.ts.
pub const CURRENT_SCHEMA_VERSION: u32 = 4;

/// Schema version recorded in `meta.schemaVersion`, or 0 if meta/version absent.
fn current_version(doc: &Automerge) -> Result<i64, String> {
    let meta = doc.get(ROOT, "meta").map_err(|e| e.to_string())?;
    let Some((Value::Object(ObjType::Map), meta_id)) = meta else {
        return Ok(0);
    };
    match doc
        .get(&meta_id, "schemaVersion")
        .map_err(|e| e.to_string())?
    {
        Some((val, _)) => Ok(val.to_i64().unwrap_or(0)),
        None => Ok(0),
    }
}

/// Migrate `bytes` to the current schema. Returns `Some(new_bytes)` when the
/// schema advanced, `None` when the doc was already current (so the caller can
/// skip a redundant re-persist).
pub fn migrate(bytes: &[u8]) -> Result<Option<Vec<u8>>, String> {
    let mut doc = Automerge::load(bytes).map_err(|e| format!("automerge load failed: {e}"))?;
    let from = current_version(&doc)?;
    if from >= i64::from(CURRENT_SCHEMA_VERSION) {
        return Ok(None);
    }
    for v in (from + 1)..=i64::from(CURRENT_SCHEMA_VERSION) {
        apply_step(&mut doc, v)?;
    }
    Ok(Some(doc.save()))
}

fn apply_step(doc: &mut Automerge, v: i64) -> Result<(), String> {
    let mut tx = doc.transaction();
    match v {
        // v2: areas + projects collections.
        2 => {
            ensure_map(&mut tx, "areas")?;
            ensure_list(&mut tx, "areaOrder")?;
            ensure_map(&mut tx, "projects")?;
            ensure_list(&mut tx, "projectOrder")?;
        }
        // v3: optional Todo fields only — no structural change (matches TS noop).
        3 => {}
        // v4: headings collection.
        4 => {
            ensure_map(&mut tx, "headings")?;
            ensure_list(&mut tx, "headingOrder")?;
        }
        _ => {}
    }
    // Bump meta.schemaVersion, creating the meta map if absent (mirrors TS).
    let meta_id = match tx.get(ROOT, "meta").map_err(|e| e.to_string())? {
        Some((Value::Object(ObjType::Map), id)) => id,
        _ => tx
            .put_object(ROOT, "meta", ObjType::Map)
            .map_err(|e| e.to_string())?,
    };
    tx.put(&meta_id, "schemaVersion", v)
        .map_err(|e| e.to_string())?;
    tx.commit();
    Ok(())
}

/// Idempotently create a top-level map at `key` if it does not already exist.
fn ensure_map<T: Transactable>(tx: &mut T, key: &str) -> Result<(), String> {
    if tx.get(ROOT, key).map_err(|e| e.to_string())?.is_none() {
        tx.put_object(ROOT, key, ObjType::Map)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Idempotently create a top-level list at `key` if it does not already exist.
fn ensure_list<T: Transactable>(tx: &mut T, key: &str) -> Result<(), String> {
    if tx.get(ROOT, key).map_err(|e| e.to_string())?.is_none() {
        tx.put_object(ROOT, key, ObjType::List)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOC_V1: &[u8] = include_bytes!("../../tests/fixtures/doc-v1.automerge");
    const DOC_V4: &[u8] = include_bytes!("../../tests/fixtures/doc-v4.automerge");

    #[test]
    fn migrates_legacy_v1_to_v4() {
        let migrated = migrate(DOC_V1).unwrap().expect("v1 doc migrates");
        let doc = Automerge::load(&migrated).unwrap();
        assert_eq!(current_version(&doc).unwrap(), 4);
        for key in [
            "areas",
            "areaOrder",
            "projects",
            "projectOrder",
            "headings",
            "headingOrder",
        ] {
            assert!(
                doc.get(ROOT, key).unwrap().is_some(),
                "{key} created by migration"
            );
        }
        // pre-existing data is preserved
        assert!(doc.get(ROOT, "todos").unwrap().is_some());
    }

    #[test]
    fn already_current_doc_is_noop() {
        assert!(
            migrate(DOC_V4).unwrap().is_none(),
            "a v4 doc needs no migration"
        );
    }

    #[test]
    fn migration_is_idempotent() {
        let once = migrate(DOC_V1).unwrap().unwrap();
        assert!(
            migrate(&once).unwrap().is_none(),
            "re-migrating an already-migrated doc is a noop"
        );
    }

    /// Drift guard: fails to compile/run the moment the TS source bumps
    /// CURRENT_SCHEMA_VERSION without the Rust constant following.
    #[test]
    fn schema_version_matches_typescript() {
        let ts = include_str!("../../../../../packages/core/src/migrations/index.ts");
        let needle = "CURRENT_SCHEMA_VERSION = ";
        let idx = ts.find(needle).expect("TS defines CURRENT_SCHEMA_VERSION");
        let digits: String = ts[idx + needle.len()..]
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        let ts_version: u32 = digits.parse().expect("parse TS schema version");
        assert_eq!(
            ts_version, CURRENT_SCHEMA_VERSION,
            "Rust schema version drifted from TS migrations"
        );
    }
}
