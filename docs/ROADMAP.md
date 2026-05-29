# Roadmap — Production-Readiness (Desktop + Web, public 1.0)

Scope for first release: **Desktop (Tauri) + Web**. Distribution: **signed GitHub releases**.
Bar: **polished public 1.0**. **Mobile deferred to post-1.0.**

Every epic ships unit + integration tests in the same PR (see CLAUDE.md / `todo-testing`).

## Where we are

`packages/core` (TodoStore, SyncEngine, identity, pairing FSM, migrations v1→4) and `packages/ui`
(4 screens, 22 components) are real, typed, well-covered. At-rest encryption on both platforms now:
web OPFS+AES-GCM ([webStorage.ts](../apps/web/src/storage/webStorage.ts)), desktop SQLCipher.

**M1 done (2026-05): transport.** iroh syncs desktop (Rust) + web (WASM); QR pairing + reconnect.
**M2 done (2026-05): desktop persistence.** Native SQLCipher storage + OS-keyring keys (SQLCipher key
+ iroh `SecretKey` → stable NodeId across restarts); Rust mirror of doc migrations. `cargo test` gates CI.

Remaining gaps:

- **Critical data flows still noop**: backup export (P9.5), device wipe (P9.6) — M3. Device identity /
  peer count wired from the transport (P9.4/P9.7); QR encode + camera scan done (P9.1/P9.8).
- **No release engineering**: everything pinned at `0.0.0`, no signing/notarization, no release CI.

## Critical path

~~M1 (transport)~~ ✅ → ~~M2 (desktop persistence)~~ ✅ → **M3 (data-safety) ← next** →
M4 (robustness) → M5 (security gate) → M6 (release) → M7 (polish) → M8 (launch).
**M5 and M6 are hard gates before any public build.**

---

## M1 — P2P Transport Foundation ✅ *(DONE — code complete, CI-verified)*

Two devices pair via QR + sync over iroh (pinned `=1.0.0-rc.0`). Desktop Rust `iroh_*` (8 cmds,
[src/iroh/](../apps/desktop/src-tauri/src/iroh/)) + web iroh-wasm Worker
([packages/iroh-wasm](../packages/iroh-wasm/), relay-only, `make wasm` needs Homebrew LLVM). Wire:
ALPN `todo-p2p/sync/1`, single-use 60s tickets, signature reconnect, one Automerge change per
bi-stream. Adapter factory selects native/WASM/Null. Safari → `Unsupported` (no WebTransport).

⚠️ **Still needs manual/hardware verify** (no-egress CI can't): real two-device sync over a live
relay (desktop↔desktop, web↔web, desktop↔web) + kill/reconnect; camera QR scan on a device;
`make mac` launch + Tauri invoke arg-casing.

## M2 — Desktop Native Persistence & Key Storage ✅ *(DONE — code complete, CI-verified)*

Desktop stores encrypted at rest like web.

- ✅ **E2.1 SQLCipher StorageAdapter.** 8 `storage_*` cmds (rusqlite bundled-sqlcipher, pinned 0.32 —
  0.40 breaks on stable rustc), [storage/mod.rs](../apps/desktop/src-tauri/src/storage/mod.rs).
- ✅ **E2.2 OS keyring SecureKeyStore** ([keystore/mod.rs](../apps/desktop/src-tauri/src/keystore/mod.rs)).
  Holds SQLCipher key + iroh `SecretKey` (durable NodeId). No `keystore_*` command (key unexportable);
  raw key never read/logged; `isHardwareBacked=false` honest.
- ✅ **E2.3 Migration parity** ([migrations/mod.rs](../apps/desktop/src-tauri/src/migrations/mod.rs)).
  Rust `automerge` 0.6.1 mirror of doc migrations v2/v3/v4; drift test + JS↔Rust format lock. Migrates
  on load, persists snapshot (no change-log truncation — pending deltas safe to replay). Random actor.
- ✅ **TS:** `TauriStorageAdapter` proxies `storage_*`; `createRuntime` picks by `isTauri()`.
- ✅ **Tests (CI):** Rust 24 (storage contract+restart+wrong-key, keystore mock, migration, iroh,
  format lock) + TS adapter mock-invoke. `cargo test` now gates CI + `make test`.

⚠️ **Still needs manual/hardware verify**: `make mac` launch; quit/relaunch persists + NodeId stable;
`strings todo.db` shows no plaintext; two-device reconnect to durable NodeId.

## M3 — Data-Safety & Critical Product Flows (P9.x)

Goal: no destructive op is a noop; no-recovery model honored safely.

- **E3.1 Encrypted backup export (P9.5).** User-managed encrypted Automerge snapshot via OS file
  dialog (desktop) / download (web). Never auto-upload. Clear "only recovery" copy.
- **E3.2 Device wipe + reset (P9.6).** Destructive confirm; clears storage + keystore + trusted peers.
- **E3.3 Device identity + paired-peer count (P9.4/P9.7).** Replace placeholder `a3·f9·7c` with real
  transport values.
- **E3.4 Settings/sidebar integration (P9.9), desktop "view source" (P9.2), release URL (P9.3).**
- **Tests:** export→wipe→import round-trip restores state; wipe leaves no plaintext residue.

Key files: [App.tsx](../apps/web/src/App.tsx) (P9.4–9.9),
[Settings.tsx](../packages/ui/src/screens/Settings.tsx),
[Unsupported.tsx](../packages/ui/src/screens/Unsupported.tsx).

## M4 — Robustness & Error Handling

Goal: failures visible and recoverable, never silent data loss.

- **E4.1 React error boundary + global `unhandledrejection` handler** (web + desktop webview).
- **E4.2 Surface SyncEngine error events to UI** (toast/banner) — guarantee a subscriber so errors
  never vanish.
- **E4.3 Peer-status + offline/reconnect UX.** Connection state in UI; auto-reconnect to trusted peers.
- **E4.4 Surface Tauri bridge failures** (shortcut registration, command errors) instead of stderr-only.
- **Tests:** simulated adapter failure renders error UI; dropped-connection reconnect; boundary catch.

## M5 — Security Hardening & Audit *(release gate)*

Goal: verify every CLAUDE.md / `todo-security` invariant holds in the shipped build.

- **E5.1 CSP lockdown** — no `unsafe-inline`, no remote scripts, `wasm-unsafe-eval` scoped to
  iroh/Automerge/SQLite WASM only, no inline `style={}`, no remote `@font-face`.
- **E5.2 Tauri capabilities lockdown** — only `iroh_*`, `storage_*`, `dialog`, `global-shortcut`;
  no `shell`/`http`/broad `fs`.
- **E5.3 Egress audit** — no telemetry/analytics/3rd-party SDK; only iroh peers + DERP relays.
- **E5.4 Secret-logging audit** — no raw keys, raw Automerge changes, or peer fingerprints logged.
- **E5.5 Pairing security review** — single-use + 60s expiry + signature reconnect under adversarial cases.
- **E5.6 Threat model doc + run `/security-review`** on the full branch.

## M6 — Release Engineering (signed GitHub releases)

Goal: users download a signed, verifiable build from GitHub.

- **E6.1 Versioning** — replace `0.0.0` everywhere (`package.json`, `Cargo.toml`, `tauri.conf.json`)
  with single source of truth + bump script. Reconcile bundle IDs (`com.todop2p.desktop` vs `.app`).
- **E6.2 Sign + notarize** — mac notarization, win signing, linux AppImage/deb; .dmg/.msi/.AppImage.
- **E6.3 GitHub Actions release workflow** — build matrix, artifacts, checksums, release notes.
- **E6.4 Web deploy** — static host with strict CSP headers; self-origin assets only.
- **E6.5 Update strategy** — manual download model; optional non-telemetry "update available" check
  against GitHub releases. No auto-upload, no phone-home beyond version check.

## M7 — Polish (public 1.0 bar)

- **E7.1 Design audit** (`todo-design`): Things3 dark aesthetic, visual QA both platforms.
- **E7.2 Accessibility** — keyboard nav, focus management, ARIA, contrast.
- **E7.3 Performance** — large-list virtualization, sync throughput, cold-start (SyncEngine compaction).
- **E7.4 First-run / onboarding** — empty states, pairing wizard, no-recovery warning surfaced early.
- **E7.5 Cross-platform QA matrix** — mac/linux/win + Chrome/Edge/Firefox; verify Safari → Unsupported.

## M8 — Docs & Launch

- **E8.1 User docs** — install, pairing, backup, **no-recovery** warning; README refresh.
- **E8.2 Fix [ARCHITECTURE.md](./ARCHITECTURE.md) drift** — Tamagui→Tailwind v4; mark mobile as post-1.0.
- **E8.3 Privacy/security statement, license, CONTRIBUTING** check.
- **E8.4 Beta/dogfood → bug triage → 1.0 cut.**

## Post-1.0 (out of scope, tracked)

- **Mobile (Expo)** — iroh-ffi Expo Module, op-sqlite (SQLCipher), expo-secure-store, full RN UI
  port. Its own milestone after desktop+web 1.0 ships.

---

## Verification (per milestone, end-to-end)

- **Sync:** pair two devices via QR; create/edit/reorder on one; confirm convergence on the other;
  kill + reconnect; confirm signature-based reconnect and no data loss.
- **At-rest:** inspect on-disk SQLCipher DB (desktop) and OPFS blobs (web) — no plaintext todos/keys.
- **Backup:** export → wipe → import restores exact state.
- **Security:** `/security-review` clean; CSP + Tauri capabilities audited; no egress beyond iroh.
- **Release:** download signed artifact on a clean machine; verify checksum + signature; app launches
  and pairs.
- **Tests:** `make test` + `make test-e2e` green; CI enforces unit+integration coverage per PR.
