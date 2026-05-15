---
name: todo-security
description: todo-p2p privacy/security rules (non-negotiable). Use when touching networking, crypto, key storage, logging, Tauri allowlist, CSP, pairing, transports, backup/export.
---

# Privacy & Security (non-negotiable)

**Network egress**: No telemetry, analytics, crash reporting, or third-party SDKs that phone home. Allowed egress = iroh peers + iroh relays only. Any other egress → raise explicitly before adding. No exceptions.

**Logging**: Never log secrets, raw Automerge changes, or peer fingerprints. Applies to console, files, Tauri events, telemetry stubs, dev-mode dumps.

**At-rest encryption**: All at-rest data encrypted. Key in platform secret store — macOS=Keychain, Windows=Credential Manager, Linux=Secret Service, Android=Android Keystore, Web=non-extractable WebCrypto key. Never read or export the raw key.

**Pairing**: Tickets are single-use and expire in 60 seconds. Post-pairing peer auth = signature on every connect. Trusted-peers list persists locally.

**Tauri allowlist**: Allowed = `iroh_*`, `storage_*`, `dialog`. Disallowed = `shell`, `http`, broad `fs`. Do not widen.

**Web CSP (strict)**: No `unsafe-inline`. No remote scripts. `wasm-unsafe-eval` allowed only for iroh, Automerge, SQLite WASM bundles.

**Transport fallback**: Browsers without WebTransport (Safari at time of writing) → show unsupported screen. Never silently fall back to a less private transport.

**Recovery / backup**: No recovery mechanism by design — lose all devices = lose data. "Export backup" = user-managed encrypted Automerge snapshot. Surface clearly to user. Never auto-upload.
