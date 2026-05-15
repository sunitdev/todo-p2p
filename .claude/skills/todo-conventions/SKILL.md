---
name: todo-conventions
description: todo-p2p code conventions — core purity, adapter boundaries, async errors, migrations, screen placement, icons. Use when editing packages/core, packages/ui, adapters, migrations, screens, icon usage.
---

# Conventions

**Core purity**: `packages/core` = pure TS. No React/RN/Tauri imports. Platform-specific → adapter iface under `packages/core/src/adapters`.

**Async errors**: sync-path errors → `syncEngine` event emitter. Never throw into UI.

**Comments**: default none. Only when WHY non-obvious — hidden constraint, subtle invariant, bug workaround, surprising behavior. Skip restating WHAT. No task/PR/ticket refs. Remove fluff when editing nearby.

**Migrations**:
- Live in `packages/core/src/migrations/`
- Desktop Rust keeps parallel constant
- Build-time test keeps in sync → never silence
- Inside `Automerge.change`: never reassign existing obj/map prop to itself (e.g. `d.meta = d.meta ?? {...}`) — Automerge throws "Cannot create a reference to an existing document object". Use `if (!d.meta) d.meta = {...}`.
- Automerge rejects `undefined` (not JSON). Never spread input obj w/ optional `undefined` keys into doc. Build assigned obj explicitly, gate optional w/ `if (val) d.x = val`. Clear w/ `delete d.x`.

**Screens**:
- Shared (cross-platform) → `packages/ui/screens`
- Platform-only (camera, OS file dialogs) → `apps/*/src/screens`

**Configs**:
- TS preset → `tooling/typescript/base.json` (extend, override `composite`/`noEmit` per-app)
- ESLint flat preset → `tooling/eslint/index.js`, re-exported from `/eslint.config.js`
- Exact version pins — `bunfig.toml` enforces `install.exact = true`

**Apps vs packages**:
- `apps/*` = leaf, `composite:false`, `noEmit:true`
- `packages/*` = composite, emit decls

**Icons**:
- Lucide only. Web/desktop = `lucide-react`. Mobile = `lucide-react-native` (+ `react-native-svg` peer).
- Per-icon import: `import { Check } from 'lucide-react'`. No barrel star.
- Never CDN/remote — CSP violation. Bundle via npm only.
- Mobile pkg deferred until `apps/mobile` scaffolded.

**Docker**:
- Web dev container @ `infra/docker/web.Dockerfile` + `docker-compose.yml`
- Build context = repo root (compose `context: ../..`)
- Tauri never in Docker (needs native WebView)
