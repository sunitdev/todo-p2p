# Contributing

## Prereqs

- [Bun](https://bun.sh) ≥ 1.3
- For desktop dev: [Rust](https://rustup.rs) + Xcode CLT (macOS) / build tools (Linux/Windows)
- For docker dev: Docker Desktop or Docker Engine + Compose

## Quickstart

```sh
make install      # bun install
make web          # web app via Docker, http://localhost:5173
make mac          # native Tauri desktop window (needs Rust)
make help         # list all targets
```

## Repo layout

```
apps/             # deployable apps
  web/            # Vite + React (browser + Tauri webview source)
  desktop/        # Tauri 2 shell (loads apps/web)
packages/         # shared libs
  core/           # pure TS — CRDT, sync engine, identity, pairing
  ui/             # Tamagui shared screens + components
infra/            # deployment / dev infra
  docker/         # Dockerfile + compose for web dev container
tooling/          # shared dev configs
  typescript/     # tsconfig presets
  eslint/         # ESLint flat-config preset
docs/             # human-readable docs
scripts/          # build / maintenance scripts
.claude/          # Claude Code skills + project memory
.github/          # CI workflows
```

## Workflow

1. Create branch off `main`.
2. Code. Adhere to `CLAUDE.md` critical rules + `.claude/skills/todo-conventions`.
3. `make typecheck && make test && make lint` before pushing.
4. PR with description of *why*, not just *what*.

## Critical rules (non-negotiable)

See [CLAUDE.md](CLAUDE.md) "Critical rules" section + `.claude/skills/todo-security`. No telemetry, strict CSP, minimal Tauri allowlist, no recovery mechanism.
