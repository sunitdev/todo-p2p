---
name: todo-architecture
description: todo-p2p architecture — UI/core split, adapters, runtime adapter pick, QR pairing, no-recovery. Use for cross-cutting changes, adapters, sync engine, pairing.
---

# Architecture

Layout:
- `apps/web` (Vite+React+Tailwind v4) → browser + Tauri webview
- `apps/desktop` (Tauri 2 + Rust) → loads `apps/web` build
- `apps/mobile` (Expo+RN+NativeWind) → planned iOS+Android
- `packages/core` (pure TS) → CRDT, sync engine, identity, pairing, adapter ifaces
- `packages/ui` (React+Tailwind v4) → shared screens/components; NativeWind reuses same `@theme` tokens
- `infra/docker/` → web dev container (Bun+Vite)
- `tooling/{typescript,eslint}` → shared configs
- `docs/ARCHITECTURE.md` → long-form

Core ifaces in `packages/core/src/adapters/`: `StorageAdapter`, `TransportAdapter`, `SecureKeyStore`. 6 adapter packages impl across 3 hosts.

Runtime pick: `apps/web` selects Tauri or WASM adapters based on `window.__TAURI__` presence.

Testability: `syncEngine.ts` talks only to ifaces → Node-testable.

**SyncEngine invariant**: first persist after cold start w/ empty storage MUST `saveDoc(store.save())` (not `appendChange`). Snapshot embeds Automerge actor's `init`; else reload calls `TodoStore.create()` (fresh actor) → logged change's dep on old init can't resolve → `applyChange` silently no-ops → write lost.

Pairing (QR):
1. Existing device shows single-use iroh ticket + 6-word fingerprint.
2. New device scans QR, dials over iroh.
3. Noise handshake.
4. Both show fingerprints; user confirms match out-of-band.
5. Mismatch/fail → rejected, retry w/ new ticket.
6. On success → full Automerge sync.
7. Persist trusted-peers list; reconnect auth = signatures.

No recovery: all devices lost = data gone. "Export backup" = user-managed encrypted Automerge snapshot. Surface clearly. Never auto-upload.
