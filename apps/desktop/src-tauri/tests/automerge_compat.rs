//! Cross-format lock: the Rust `automerge` 0.6.1 crate must load the columnar
//! bytes written by @automerge/automerge 2.2.8 (JS, packages/core), and its own
//! `save()` output must reload. This guards the highest-risk M2 assumption — that
//! the two automerge versions share a wire format — so a future bump of either
//! crate that breaks interop fails CI. Fixtures come from
//! packages/core/scripts/gen-automerge-fixtures.ts.

use automerge::{Automerge, ReadDoc, ROOT};

const DOC_V1: &[u8] = include_bytes!("fixtures/doc-v1.automerge");
const DOC_V4: &[u8] = include_bytes!("fixtures/doc-v4.automerge");

fn schema_version(doc: &Automerge) -> i64 {
    let (meta, _) = doc.get(ROOT, "meta").unwrap().expect("meta exists");
    let meta_id = match meta {
        automerge::Value::Object(_) => doc.get(ROOT, "meta").unwrap().unwrap().1,
        _ => panic!("meta is not a map"),
    };
    let (v, _) = doc
        .get(&meta_id, "schemaVersion")
        .unwrap()
        .expect("schemaVersion exists");
    v.to_i64().expect("schemaVersion is int")
}

#[test]
fn loads_js_saved_v1_doc() {
    let doc = Automerge::load(DOC_V1).expect("rust automerge loads JS v1 bytes");
    assert_eq!(schema_version(&doc), 1);
    // legacy doc has todos but NOT areas/headings
    assert!(doc.get(ROOT, "todos").unwrap().is_some());
    assert!(doc.get(ROOT, "areas").unwrap().is_none());
    assert!(doc.get(ROOT, "headings").unwrap().is_none());
}

#[test]
fn loads_js_saved_v4_doc() {
    let doc = Automerge::load(DOC_V4).expect("rust automerge loads JS v4 bytes");
    assert_eq!(schema_version(&doc), 4);
    assert!(doc.get(ROOT, "headings").unwrap().is_some());
}

#[test]
fn rust_saved_doc_reloads() {
    // round-trip through the rust crate (proves save() output is itself valid)
    let doc = Automerge::load(DOC_V4).unwrap();
    let bytes = doc.save();
    let reloaded = Automerge::load(&bytes).expect("rust reloads its own save");
    assert_eq!(schema_version(&reloaded), 4);
}
