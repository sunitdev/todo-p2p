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
- `make wasm` → build browser iroh transport (`packages/iroh-wasm` → `pkg/`)
- `make wasm-deps` → print wasm prereqs
- `make help`

Bun direct:
- Install: `bun install`
- Web: `bun --filter @todo-p2p/web dev` → Vite (5173)
- Desktop (Tauri 2):
  - `bun --filter @todo-p2p/desktop tauri dev` → auto-runs web
  - `bun --filter @todo-p2p/desktop tauri build` → prod bundle
  - `bun --filter @todo-p2p/desktop tauri icon path/to/source.png` → bootstrap icons (once)
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` → Rust Tauri cmd tests (iroh transport: two-endpoint loopback sync, ticket expiry/single-use, trusted-reconnect)
- WASM transport (browser iroh, `packages/iroh-wasm` → Rust→wasm via wasm-pack):
  - `make wasm` (= `scripts/build-wasm.sh release`); `… dev` for fast unoptimized
  - Prereqs (`make wasm-deps`): `rustup target add wasm32-unknown-unknown`; `cargo install wasm-pack`; macOS `brew install llvm` (Apple clang lacks the wasm32 target — script auto-points `CC_wasm32_unknown_unknown` at `/opt/homebrew/opt/llvm`)
  - Build sets `RUSTFLAGS=--cfg getrandom_backend="wasm_js"`; wasm-opt features enabled via `[package.metadata.wasm-pack.profile.release]` in the crate's Cargo.toml
  - `apps/web` `build` runs `build:wasm` first (the `pkg/` import is a build prereq); `pkg/` is gitignored
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
