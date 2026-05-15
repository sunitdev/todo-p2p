# Architecture

## Goal

Server-less, end-to-end encrypted personal TODO. Sync peer-to-peer between a single user's own devices via [iroh](https://www.iroh.computer). No accounts, no backend.

## Targets

| Platform | Stack |
|----------|-------|
| Desktop (macOS / Linux / Windows) | Tauri 2 — Rust + iroh crate + SQLCipher (rusqlite) + OS keyring |
| Mobile (iOS / Android) | Expo + React Native + Tamagui — iroh-ffi Expo Module + op-sqlite (SQLCipher) |
| Web | Vite + React + Tamagui — iroh-js WASM in Worker + wa-sqlite + OPFS + AES-GCM |

## Layout

```
apps/
  web/        Vite + React shell. Loaded by Tauri webview on desktop.
  desktop/    Tauri 2 + Rust backend.
              src-tauri/ — Rust crate, capabilities, icons.
  mobile/     (planned) Expo + RN.
packages/
  core/       Pure TypeScript. CRDT (Automerge), sync engine, identity, pairing.
              Adapter interfaces only — no platform code.
  ui/         Shared Tamagui screens + components. Consumed by web + mobile.
infra/docker/ Web dev container (Bun + Vite, port 5173).
tooling/      Shared TypeScript + ESLint configs.
```

## UI / core split

- `packages/core` is **pure TS**. No React, no RN, no Tauri imports. All platform deps go behind adapter interfaces declared in `packages/core/src/adapters/`.
- `packages/ui` holds shared screens / components in Tamagui. Consumed by `apps/web` and `apps/mobile`.
- Platform-only screens (camera, OS file dialogs) live in `apps/*/src/screens/`.

## Adapter interfaces (`packages/core/src/adapters/`)

- `StorageAdapter` — SQLCipher (native) / wa-sqlite+OPFS+AES-GCM (web)
- `TransportAdapter` — iroh native crate (Tauri) / iroh-ffi (mobile) / iroh-js WASM Worker (web)
- `SecureKeyStore` — Keychain / Credential Manager / Secret Service / Android Keystore / non-extractable WebCrypto

Six adapter packages implement the three interfaces across three hosts.

## Runtime adapter selection

`apps/web` picks Tauri vs WASM adapters automatically based on `window.__TAURI__`.

## Sync engine

`packages/core/src/syncEngine.ts` talks only to interfaces → Node-testable. Sync-path errors surface via event emitter; never throw into UI.

## Pairing flow (QR)

1. Existing device shows a single-use iroh ticket + 6-word fingerprint.
2. New device scans QR, dials over iroh.
3. Devices complete the Noise handshake.
4. Both display fingerprints; user confirms match out-of-band.
5. Mismatch / connection failure → pairing rejected. Retry with new ticket.
6. On success: full Automerge sync.
7. Peers persist a trusted-peers list. Reconnect auth = signature.

Tickets single-use, 60-second expiry.

## No-recovery model

If all devices are lost or inaccessible, **data is gone**. There is no server, no recovery key, no escrow. "Export backup" = user-managed encrypted Automerge snapshot — surface clearly, never auto-upload.

## Privacy & security

See [CLAUDE.md](../CLAUDE.md) "Critical rules" + `.claude/skills/todo-security`. Highlights:

- No telemetry, analytics, crash reporting, or third-party SDKs.
- Allowed network egress = iroh peers + iroh DERP relays only. Relays see ciphertext.
- All at-rest data encrypted. Keys live in OS secret store / non-extractable WebCrypto. Raw key never read or exported.
- Strict CSP — no `unsafe-inline`, no remote scripts. `wasm-unsafe-eval` only for iroh / Automerge / SQLite WASM bundles.
- Tight Tauri allowlist — `iroh_*`, `storage_*`, `dialog`. No `shell` / `http` / broad `fs`.
- Browsers without WebTransport (Safari at time of writing) → unsupported screen. No silent fallback to weaker transport.

## Migrations

Live in `packages/core/src/migrations/`. Desktop Rust keeps a parallel constant. Build-time test pins them in sync — never silence.
