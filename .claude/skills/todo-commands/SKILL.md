---
name: todo-commands
description: todo-p2p command reference. Use for make/bun/cargo/eas/expo/tauri invocations — install, build, test, run.
---

# Commands

Top-level (Makefile):
- `make install` → bun install
- `make web` → web app in Docker → http://localhost:5173 (HMR)
- `make web-down` → stop web container
- `make mac` → native Tauri desktop dev (Docker not supported)
- `make mac-deps` → print Rust + Xcode CLT prereqs + icon bootstrap cmd
- `make typecheck` / `make test` / `make lint` / `make clean`
- `make help` → list targets

Direct bun (escape hatch):
- Install: `bun install`
- Web: `bun --filter @todo-p2p/web dev` → Vite (port 5173)
- Desktop (Tauri 2):
  - `bun --filter @todo-p2p/desktop tauri dev` → auto-runs web dev server
  - `bun --filter @todo-p2p/desktop tauri build` → prod bundle
  - `bun --filter @todo-p2p/desktop tauri icon path/to/source.png` → bootstrap icons (one-time)
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` → Rust Tauri cmd tests
- Mobile (Expo, dev client only, NOT Expo Go):
  - `bun --filter @todo-p2p/mobile start` → Metro (own Node, expected)
  - `bun --filter @todo-p2p/mobile ios|android` → simulator/emulator
  - `bunx eas build --profile development --platform ios|android` → device build
- Core (`packages/core`):
  - `bun --filter @todo-p2p/core test` → bun test
  - `bun --filter @todo-p2p/core test syncEngine` → single file
- Workspace:
  - `bun typecheck` → tsc -b --noEmit
  - `bun lint` → eslint (flat config @ /eslint.config.js → tooling/eslint preset)
  - `bun test` → all packages
- Docker compose (compose file lives at `infra/docker/docker-compose.yml`):
  - `docker compose -f infra/docker/docker-compose.yml up --build web`
  - `docker compose -f infra/docker/docker-compose.yml down`

Native rebuild: `bun tools:build-iroh` → rebuild iroh-ffi xcframework + Android .aar (after iroh version bump)
