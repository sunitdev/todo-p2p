---
name: todo-conventions
description: todo-p2p code conventions — core purity, adapter boundaries, async errors, migrations, screen placement, icons. Use when editing packages/core, packages/ui, adapters, migrations, screens, icon usage.
---

# Conventions

Core purity: `packages/core` = pure TS. No React/RN/Tauri imports. Platform-specific → adapter iface under `packages/core/src/adapters`.

Async errors: sync-path errors → `syncEngine` event emitter. Never throw into UI.

Comments: default none. Add only when WHY non-obvious — hidden constraint, subtle invariant, bug workaround, surprising behavior. Skip restating WHAT (names already say). No task/PR/ticket refs ("added for X", "used by Y"). Remove existing fluff when editing nearby.

Migrations:
- Live in `packages/core/src/migrations/`
- Desktop Rust keeps parallel constant
- Build-time test keeps them in sync → never silence

Screens:
- Shared (cross-platform) → `packages/ui/screens`
- Platform-only (camera, OS file dialogs) → `apps/*/src/screens`

Configs:
- TS preset → `tooling/typescript/base.json` (extend, override `composite`/`noEmit` per-app)
- ESLint flat preset → `tooling/eslint/index.js`, re-exported from `/eslint.config.js`
- Exact version pins everywhere — `bunfig.toml` enforces `install.exact = true`

Apps vs packages:
- `apps/*` = leaf consumers, `composite:false`, `noEmit:true`
- `packages/*` = composite TS projects, emit declarations

Icons:
- Lucide only. Web/desktop = `lucide-react`. Mobile = `lucide-react-native` (+ `react-native-svg` peer).
- Per-icon import (tree-shake): `import { Check } from 'lucide-react'`. No barrel star imports.
- Never CDN/remote (`https://lucide.dev`, unpkg) — violates CSP. Bundle via npm only.
- Mobile pkg deferred until `apps/mobile` scaffolded.

Docker:
- Web dev container at `infra/docker/web.Dockerfile` + `docker-compose.yml`
- Build context = repo root (compose `context: ../..`)
- Tauri never runs in Docker (needs native WebView)
