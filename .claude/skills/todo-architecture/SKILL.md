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

Core ifaces in `packages/core/src/adapters/`: `StorageAdapter`, `TransportAdapter`, `SecureKeyStore`. 6 adapter packages impl across 3 hosts. `TransportAdapter` also has `connectionTo(peerId)` → sendable handle for *inbound* peers (those that dialed us; no dial result).

Runtime pick: `apps/web/src/runtime/createRuntime.ts` selects transport — `isTauri()` → `IrohTauriTransport`; else `hasWebTransport()` → `IrohWebTransport` (catch → `NullTransport`, single-device). Detection in `runtime/env.ts`.

**M1 transport (iroh 1.0.0-rc.0, pinned `=` — later releases renamed `NodeId/NodeAddr`→`EndpointId/EndpointAddr`):**
- **Identity = iroh `SecretKey`** (= its `EndpointId`). iroh QUIC/TLS handshake binds every conn to the dialed id → that *is* "signature reconnect" (no separate Ed25519 layer). `identity.ts` kept only for the 6-word fingerprint. M1 secret key is **ephemeral** (NodeId regenerates per restart); durable keyring = M2, so trusted-reconnect is session-scoped.
- **Desktop**: iroh runs in Rust behind `iroh_*` Tauri commands (`apps/desktop/src-tauri/src/iroh/`, `lib.rs` split from `main.rs`). Events to webview via `tauri::ipc::Channel`, not `emit`. App commands need no ACL entry (only plugin/core cmds do).
- **Web**: own Rust→wasm crate `packages/iroh-wasm` (wasm-bindgen `IrohNode`), run in a Web Worker (`runtime/irohWorker.ts`) behind `IrohWebTransport`. Browser iroh is **relay-only** (no UDP; WebSocket→relay; still E2EE).
- **Wire protocol** (identical desktop+wasm): ALPN `todo-p2p/sync/1`; dialer's first bi-stream = JSON `AuthFrame` (`Pair{token}` from ticket, or `Trusted`) + 1-byte ack; then one Automerge change per bi-stream (`read_to_end`). Ticket = JSON `{addr: EndpointAddr, token}`; single-use+60s TTL enforced in a Rust/wasm `PairingRegistry` (the security boundary, never UI).
- **Connection ownership**: `SyncEngine` only consumes `onMessage` (never calls `start()`). `runtime/peerManager.ts` owns live conns, feeds `engine.commit(change, peers())` (via `StoreProvider` `peers` prop), re-dials trusted peers on drop. `runtime/pairingController.ts` drives the FSM + initial full-history sync (`SyncEngine.initialSyncTo` → `store.allChanges()`, since `applyChange` takes individual changes, not a full save).

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
