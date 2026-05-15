---
name: todo-architecture
description: todo-p2p architecture — UI/core split, adapters, runtime adapter pick, QR pairing, no-recovery. Use for cross-cutting changes, adapters, sync engine, pairing.
---

# Architecture

Repo layout:
- `apps/web` (Vite+React+Tailwind v4) → browser + Tauri webview
- `apps/desktop` (Tauri 2 + Rust) → loads `apps/web` build
- `apps/mobile` (Expo + RN + NativeWind) → planned; iOS + Android
- `packages/core` (pure TS) → CRDT, sync engine, identity, pairing, adapter ifaces
- `packages/ui` (React + Tailwind v4) → shared screens/components for web + mobile (NativeWind reuses same `@theme` tokens)
- `infra/docker/` → web dev container (Bun + Vite)
- `tooling/{typescript,eslint}` → shared configs
- `docs/ARCHITECTURE.md` → human-readable long-form

Core interfaces in `packages/core/src/adapters/`: `StorageAdapter`, `TransportAdapter`, `SecureKeyStore`. 6 adapter packages impl them across 3 hosts.

Runtime pick: `apps/web` automatically selects Tauri or WASM adapters based on whether `window.__TAURI__` is present.

Testability: `syncEngine.ts` talks only to interfaces → Node-testable.

Pairing (QR):
1. Existing device shows a single-use iroh ticket and a 6-word fingerprint.
2. New device scans the QR and dials over iroh.
3. Devices complete the Noise handshake.
4. Both devices display fingerprints; user confirms they match out-of-band.
5. If fingerprints do not match or connection fails, pairing is rejected and the user must retry with a new ticket.
6. On success, devices run full Automerge sync.
7. Peers persist a trusted-peers list; reconnect authentication uses signatures.

No recovery: if all devices are permanently lost or inaccessible, data is gone. "Export backup" = user-managed encrypted Automerge snapshot. Surface clearly. Never auto-upload.
