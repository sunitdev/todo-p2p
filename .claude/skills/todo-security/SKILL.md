---
name: todo-security
description: todo-p2p privacy/security rules (non-negotiable). Use when touching networking, crypto, key storage, logging, Tauri allowlist, CSP, pairing, transports, backup/export.
---

# Privacy & Security (non-negotiable)

**Network egress**: No telemetry, analytics, crash reporting, 3rd-party SDKs phoning home. Allowed = iroh peers + iroh relays only. Any other → raise before adding. No exceptions.

**Logging**: Never log secrets, raw Automerge changes, peer fingerprints. Applies to console, files, Tauri events, telemetry stubs, dev dumps.

**At-rest encryption**: All at-rest encrypted. Key in platform secret store — macOS=Keychain, Windows=Credential Manager, Linux=Secret Service, Android=Android Keystore, Web=non-extractable WebCrypto. Never read/export raw key.

**Pairing**: Tickets single-use, 60s expiry. Post-pair auth = signature on every connect. Trusted-peers list persists locally.

**Tauri allowlist**: Allowed = `iroh_*`, `storage_*`, `dialog`. Disallowed = `shell`, `http`, broad `fs`. Do not widen.

**Web CSP (strict)**: No `unsafe-inline`. No remote scripts. `wasm-unsafe-eval` only for iroh, Automerge, SQLite WASM.

**Transport fallback**: No WebTransport (Safari) → unsupported screen. Never silently fall back to less private transport.

**Recovery/backup**: No recovery by design — lose all devices = lose data. "Export backup" = user-managed encrypted Automerge snapshot. Surface clearly. Never auto-upload.
