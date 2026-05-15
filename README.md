# todo-p2p

Server-less, end-to-end encrypted personal TODO. Sync is peer-to-peer between a single user's own devices via [iroh](https://www.iroh.computer/). No accounts, no backend, no recovery.

**Targets**: macOS / Linux / Windows desktop (Tauri 2), iOS + Android (Expo / React Native), web (Vite + React).

## Status

Pre-alpha. Scaffolded:

- `packages/core` — CRDT, sync engine, identity, pairing
- `packages/ui` — shared Tamagui components (placeholder)
- `apps/web` — Vite + React shell
- `apps/desktop` — Tauri 2 shell (loads `apps/web`)

## Quickstart

Requires [Bun](https://bun.sh) ≥ 1.3.

```sh
make install      # bun install
make web          # web app via Docker → http://localhost:5173
make mac          # native Tauri desktop window (needs Rust + Xcode CLT)
make help         # list all targets
```

`make web` requires Docker. `make mac` runs natively (Tauri cannot run inside Docker — needs native macOS WebView). First-time desktop run also needs `bun --filter @todo-p2p/desktop tauri icon path/to/icon.png` to bootstrap Tauri's icon set.

## Repo layout

```
apps/             # deployable apps
  web/            # Vite + React (browser + Tauri webview source)
  desktop/        # Tauri 2 shell
packages/         # shared libs
  core/           # pure TS — CRDT, sync, identity, pairing
  ui/             # shared Tamagui screens + components
infra/docker/     # web dev container (Bun + Vite, port 5173)
tooling/          # shared dev configs (TypeScript + ESLint presets)
docs/             # human-readable architecture + design notes
scripts/          # build / maintenance scripts
.claude/          # Claude Code skills + project memory
.github/          # CI workflows
```

## Docs

- [Architecture](docs/ARCHITECTURE.md) — UI/core split, adapter interfaces, pairing flow, no-recovery model
- [CLAUDE.md](CLAUDE.md) — critical rules, stack, self-maintenance routing
- [CONTRIBUTING](CONTRIBUTING.md) — dev workflow

## Privacy

No telemetry. No third-party SDKs that phone home. All at-rest data encrypted (SQLCipher on native, AES-GCM over OPFS on web). Only network egress is to iroh peers and public iroh DERP relays — and those see only ciphertext.

**No recovery.** If you lose all paired devices, your data is gone. Use the in-app encrypted backup export.

## License

[MIT](LICENSE)
