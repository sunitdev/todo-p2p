# CLAUDE.md

Serverless E2EE personal TODO. P2P sync via iroh between user's own devices. No accounts/backend. Targets: Tauri 2 desktop (mac/linux/win), Expo iOS+Android, Vite+React web.

## Stack

Desktop=Tauri 2 (Rust+iroh+SQLCipher/rusqlite+keyring). Web=Vite+React+Tailwind v4 (iroh-js WASM in Worker, wa-sqlite+OPFS+AES-GCM). Mobile=Expo+RN+NativeWind (iroh-ffi Expo Module, op-sqlite+SQLCipher). Core=`packages/core` pure TS, adapter ifaces. Bun workspaces; Bun=pkg mgr+runner+test. Node only via Metro.

## Layout

```
apps/{web,desktop,mobile}    deployable apps
packages/{core,ui}           shared libs (core=pure TS, ui=React+Tailwind)
infra/docker/                web dev container
tooling/{typescript,eslint}  shared configs
docs/                        ARCHITECTURE.md
scripts/                     build/maintenance
.claude/skills/              project skills
```

Entry = `Makefile`. `make help` lists targets.

## Critical rules (always-on)

- No telemetry/analytics/crash-report/3rd-party SDKs. Egress ≠ iroh peers/relays → raise first.
- Never log secrets, raw Automerge changes, peer fingerprints.
- At-rest encrypted. Key in platform secret store (Keychain/Cred Mgr/Secret Svc/Android Keystore) or non-extractable WebCrypto. Never read/export raw key.
- Pairing tickets single-use, 60s expiry. Post-pair auth = signature.
- Tauri allowlist: only `iroh_*`, `storage_*`, `dialog`. No `shell`/`http`/broad `fs`.
- Web CSP strict: no `unsafe-inline`, no remote scripts, `wasm-unsafe-eval` only for iroh+Automerge+SQLite WASM. Tailwind v4 build-time CSS self-origin. No inline `style={}`. No `@font-face` remote URL.
- No WebTransport (Safari) → unsupported screen. No silent fallback.
- No recovery. Lost devices = lost data. "Export backup" = user-managed encrypted Automerge snapshot. Never auto-upload.
- Pkg mgr = bun only. Never npm/npx/pnpm/yarn. Use `bun add`, `bun install`, `bun run`, `bunx`.
- Dev servers (vite/tauri/expo/metro) MUST stop before session end. Kill via TaskStop; verify ports free (`lsof -ti tcp:5173|tcp:1420|tcp:8081`).
- Every feature/fix lands w/ unit + integration tests in same PR. See `todo-testing`. CI fails on missing coverage.

## Skills (load on demand)

- `todo-commands` — make/bun/cargo/eas cmds
- `todo-architecture` — UI split, adapters, pairing, runtime pick
- `todo-conventions` — core purity, errors, migrations, screens, configs
- `todo-security` — full privacy/security rationale
- `todo-design` — Things3 dark aesthetic; tokens, components, screens, audit
- `todo-testing` — bun test + happy-dom + Playwright; mandatory unit+integration per feature/fix

## Self-maintenance (append-on-learn)

Major fact → persist immediately, no ask.

**Major** = new stack/tool, new convention/invariant, new cmd/workflow, arch decision, security rule change, recurring external resource, bug w/ non-obvious cause+fix, stakeholder/deadline shaping scope.

**Not major**: paths derivable by `ls`/`grep`, one-off task state, patterns in source, anything in `git log`.

**Route**:
- Always-on critical rule (security/network/data-loss) → CLAUDE.md
- Command → `todo-commands`
- Arch/adapter/sync/pairing → `todo-architecture`
- Code convention → `todo-conventions`
- Security detail → `todo-security`
- Testing convention → `todo-testing`
- Doesn't fit + recurring → new skill `.claude/skills/todo-<topic>/SKILL.md` + add to Skills list

**How**: 1-line caveman entry. Edit existing, no dupes. Contradicts existing → update. Frontmatter `description` stays accurate (loads on desc match).

**Skip if**: user says "don't remember", info ephemeral, already in `git log`/source, unsure.
