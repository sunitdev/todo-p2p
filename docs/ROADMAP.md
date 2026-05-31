# Roadmap — Production-Readiness (Desktop + Web, public 1.0)

First release: **Desktop (Tauri) + Web**. Distribution: **signed GitHub releases**.
Bar: polished public 1.0. **Mobile deferred to post-1.0.**
Every epic ships unit + integration tests in the same PR (CLAUDE.md / `todo-testing`).

## Critical path

~~M1 transport~~ ✅ → ~~M2 desktop persistence~~ ✅ → ~~M3 data-safety~~ ✅ →
**M4 robustness ← next** → M5 security gate → M6 release → M7 polish → M8 launch.
**M5 + M6 are hard gates before any public build.**

## Where we are

`packages/core` (TodoStore, SyncEngine, identity, pairing FSM, migrations v1→4) +
`packages/ui` (4 screens, 22 components): real, typed, covered. At-rest encrypted both
platforms (web OPFS+AES-GCM, desktop SQLCipher). M1–M3 code-complete + CI-green.

Remaining: **release engineering** (everything pinned `0.0.0`, no signing/notarization,
no release CI). M3 source/release URLs are placeholders in `apps/web/src/config.ts` (fill at M6).

---

## M1 — P2P Transport ✅

Two devices pair via QR + sync over iroh (`=1.0.0-rc.0`). Desktop Rust `iroh_*`
([src/iroh/](../apps/desktop/src-tauri/src/iroh/)) + web iroh-wasm Worker
([packages/iroh-wasm](../packages/iroh-wasm/), relay-only, `make wasm` needs Homebrew LLVM).
ALPN `todo-p2p/sync/1`, single-use 60s tickets, signature reconnect, one Automerge change per
bi-stream. Adapter factory picks native/WASM/Null. Safari → `Unsupported`.

⚠️ **Manual/hardware verify** (no-egress CI can't): real two-device sync over a live relay
(dd/ww/dw) + kill/reconnect; camera QR scan; `make mac` launch + Tauri invoke arg-casing.

## M2 — Desktop Native Persistence & Key Storage ✅

Encrypted at rest like web. SQLCipher StorageAdapter (8 `storage_*` cmds, rusqlite
bundled-sqlcipher pinned 0.32). OS-keyring SecureKeyStore holds SQLCipher key + iroh
`SecretKey` (durable NodeId); key unexportable, never logged. Rust `automerge` 0.6.1 mirror of
doc migrations v2/v3/v4 + JS↔Rust format lock. `TauriStorageAdapter` proxies `storage_*`;
`createRuntime` picks by `isTauri()`. `cargo test` gates CI.

⚠️ **Manual/hardware verify**: `make mac`; quit/relaunch persists + NodeId stable;
`strings todo.db` no plaintext; two-device reconnect to durable NodeId.

## M3 — Data-Safety & Critical Product Flows ✅

No destructive op is a noop; no-recovery model honored.

- **E3.1 Backup export+import (P9.5).** Passphrase-derived encryption (PBKDF2-SHA256 600k →
  AES-GCM, NOT device key → portable). Codec [backup.ts](../packages/core/src/backup.ts). File
  I/O: web Blob/`<input>`, desktop Rust `export_backup`/`import_backup` (dialog + `std::fs`).
  Import = saveDoc+truncate+reload. Never auto-uploads.
- **E3.2 Wipe + reset (P9.6).** `StorageAdapter.wipe()`: clears doc/changes/peers + drops AEAD
  key (web) / deletes `IROH_SECRET` for fresh NodeId (desktop). Reload → first-run.
- **E3.3 Identity + peer count (P9.4/P9.7).** `device.id` = real NodeId; count reactive via
  `PeerManager.onChange`.
- **E3.4 Config URLs (P9.2/P9.3).** `apps/web/src/config.ts` SOURCE_URL/RELEASE_URL placeholders
  (web "View source" anchor; Unsupported download). Desktop "View source" deferred to M6 (opener).

⚠️ **Manual/hardware verify**: desktop native save/pick dialog (`make mac`); two-device sync
after restore; `strings todo.db` post-wipe = no plaintext.

## M4 — Robustness & Error Handling ← next

Failures visible + recoverable, never silent data loss.

- **E4.1** React error boundary + global `unhandledrejection` handler (web + desktop webview).
- **E4.2** Surface SyncEngine error events to UI (toast/banner); guarantee a subscriber.
- **E4.3** Peer-status + offline/reconnect UX; auto-reconnect to trusted peers.
- **E4.4** Surface Tauri bridge failures (shortcut reg, command errors) instead of stderr-only.
- **Tests:** simulated adapter failure renders error UI; dropped-connection reconnect; boundary catch.

## M5 — Security Hardening & Audit *(release gate)*

Verify every CLAUDE.md / `todo-security` invariant in the shipped build.

- **E5.1** CSP lockdown — no `unsafe-inline`/remote scripts, `wasm-unsafe-eval` scoped to
  iroh/Automerge/SQLite, no inline `style={}`, no remote `@font-face`.
- **E5.2** Tauri capabilities lockdown — only `iroh_*`, `storage_*`, `dialog`, `global-shortcut`,
  backup/wipe cmds; no `shell`/`http`/broad `fs`.
- **E5.3** Egress audit — no telemetry/3rd-party SDK; only iroh peers + DERP relays.
- **E5.4** Secret-logging audit — no raw keys, raw changes, peer fingerprints.
- **E5.5** Pairing security review — single-use + 60s + signature reconnect, adversarial cases.
- **E5.6** Threat model doc + `/security-review` on full branch.

## M6 — Release Engineering (signed GitHub releases)

- **E6.1** Versioning — replace `0.0.0` (`package.json`, `Cargo.toml`, `tauri.conf.json`) with
  single source + bump script. Reconcile bundle IDs. Fill `config.ts` URLs.
- **E6.2** Sign + notarize — mac notarize, win sign, linux AppImage/deb; .dmg/.msi/.AppImage.
- **E6.3** GitHub Actions release workflow — build matrix, artifacts, checksums, notes.
- **E6.4** Web deploy — static host, strict CSP headers, self-origin assets.
- **E6.5** Update strategy — manual download; optional non-telemetry "update available" check vs
  GitHub releases. No phone-home beyond version check.

## M7 — Polish (1.0 bar)

- **E7.1** Design audit (`todo-design`): Things3 dark, visual QA both platforms.
- **E7.2** Accessibility — keyboard nav, focus, ARIA, contrast.
- **E7.3** Performance — large-list virtualization, sync throughput, cold-start compaction.
- **E7.4** First-run/onboarding — empty states, pairing wizard, no-recovery warning early.
- **E7.5** Cross-platform QA — mac/linux/win + Chrome/Edge/Firefox; Safari → Unsupported.

## M8 — Docs & Launch

- **E8.1** User docs — install, pairing, backup, no-recovery; README refresh.
- **E8.2** Fix [ARCHITECTURE.md](./ARCHITECTURE.md) drift — Tamagui→Tailwind v4; mobile post-1.0.
- **E8.3** Privacy/security statement, license, CONTRIBUTING.
- **E8.4** Beta/dogfood → bug triage → 1.0 cut.

## Post-1.0 (out of scope)

- **Mobile (Expo)** — iroh-ffi Expo Module, op-sqlite (SQLCipher), expo-secure-store, RN UI port.

---

## Verification (per milestone, e2e)

- **Sync:** pair via QR; create/edit/reorder on one → converges on other; kill+reconnect (signature) no loss.
- **At-rest:** SQLCipher DB (desktop) + OPFS blobs (web) — no plaintext todos/keys.
- **Backup:** export → wipe → import restores exact state.
- **Security:** `/security-review` clean; CSP + Tauri capabilities audited; no egress beyond iroh.
- **Release:** download signed artifact on clean machine; verify checksum + signature; launches + pairs.
- **Tests:** `make test` + `make test-e2e` green; CI enforces unit+integration per PR.
