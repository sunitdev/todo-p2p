---
name: todo-commands
description: todo-p2p command reference. Use for make/bun/cargo/eas/expo/tauri invocations — install, build, test, run.
---

# Commands

Makefile:
- `make install` → bun install
- `make web` → web in Docker → http://localhost:5173 (HMR)
- `make web-down` → stop web container
- `make mac` → native Tauri dev (no Docker)
- `make mac-deps` → print Rust+Xcode CLT prereqs+icon bootstrap
- `make typecheck` / `make test` / `make lint` / `make clean`
- `make help`

Bun direct:
- Install: `bun install`
- Web: `bun --filter @todo-p2p/web dev` → Vite (5173)
- Desktop (Tauri 2):
  - `bun --filter @todo-p2p/desktop tauri dev` → auto-runs web
  - `bun --filter @todo-p2p/desktop tauri build` → prod bundle
  - `bun --filter @todo-p2p/desktop tauri icon path/to/source.png` → bootstrap icons (once)
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` → Rust Tauri cmd tests
- Mobile (Expo, dev client only, NOT Expo Go):
  - `bun --filter @todo-p2p/mobile start` → Metro (own Node)
  - `bun --filter @todo-p2p/mobile ios|android` → sim/emu
  - `bunx eas build --profile development --platform ios|android` → device build
- Core:
  - `bun --filter @todo-p2p/core test`
  - `bun --filter @todo-p2p/core test syncEngine` → single
- UI:
  - `bun --filter @todo-p2p/ui test` → component+hook (happy-dom)
  - `bun --filter @todo-p2p/ui test Modal` → single
- Web:
  - `bun --filter @todo-p2p/web test` → unit (Splash/ErrorScreen, NullTransport)
  - `bun --filter @todo-p2p/web test:e2e` → Playwright (auto vite preview)
  - `make test-e2e` → same
- Workspace:
  - `bun typecheck` → tsc -b --noEmit
  - `bun lint` → eslint flat (`/eslint.config.js` → tooling/eslint preset)
  - `bun test` → all workspaces unit
  - `bun test:e2e` → Playwright (apps/web)
- Docker compose (`infra/docker/docker-compose.yml`):
  - `docker compose -f infra/docker/docker-compose.yml up --build web`
  - `docker compose -f infra/docker/docker-compose.yml down`

Native rebuild: `bun tools:build-iroh` → rebuild iroh-ffi xcframework + Android .aar (after iroh bump).
