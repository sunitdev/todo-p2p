---
name: todo-security
description: todo-p2p privacy/security rules (non-negotiable). Use when touching networking, crypto, key storage, logging, Tauri allowlist, CSP, pairing, transports, backup/export.
---

# Privacy & Security (non-negotiable)

**Network egress**: No telemetry, analytics, crash reporting, 3rd-party SDKs phoning home. Allowed = iroh peers + iroh relays only. Any other → raise before adding. No exceptions. Concrete (M1): n0 default relays — web `connect-src` allows `https://*.iroh.link wss://*.iroh.link https://*.iroh.network wss://*.iroh.network` only (relays see ciphertext). Browser iroh is relay-only. To self-host relays later, narrow this to your host.

**Logging**: Never log secrets, raw Automerge changes, peer fingerprints. Applies to console, files, Tauri events, telemetry stubs, dev dumps.

**At-rest encryption**: All at-rest encrypted. Key in platform secret store — macOS=Keychain, Windows=Credential Manager, Linux=Secret Service, Android=Android Keystore, Web=non-extractable WebCrypto. Never read/export raw key.

**Pairing**: Tickets single-use, 60s expiry. Post-pair auth = signature on every connect. Trusted-peers list persists locally.

**Tauri allowlist**: Allowed = `iroh_*`, `storage_*`, `dialog`, `export_backup`/`import_backup`, `storage_wipe`. Disallowed = `shell`, `http`, broad `fs`. Do not widen. Desktop file I/O pattern: dedicated Rust cmd opens dialog plugin (blocking_save/pick_file) + `std::fs` on the chosen path. JS never sees a path → no broad `fs`. Reuse this for any future file feature.

**Web CSP (strict)**: No `unsafe-inline`. No remote scripts. `wasm-unsafe-eval` only for iroh, Automerge, SQLite WASM.

**Transport fallback**: No WebTransport (Safari) → unsupported screen. Never silently fall back to less private transport.

**Recovery/backup**: No recovery by design — lose all devices = lose data. "Export backup" = user-managed encrypted Automerge snapshot. Surface clearly. Never auto-upload. Backup sealed with **passphrase-derived** key (PBKDF2-SHA256 600k → AES-GCM-256), NOT the device doc-key (non-extractable, can't decrypt on another device). Codec = `packages/core/src/backup.ts` (`encryptBackup`/`decryptBackup`, magic `TODOP2PB`+v1). Import = saveDoc+truncate+reload. Wipe (`storage.wipe()`) clears doc/changes/peers + drops AEAD key (web) / deletes `IROH_SECRET` for new NodeId, keeps DB key (desktop) → reload = fresh first-run.
