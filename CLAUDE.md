# CLAUDE.md

Serverless E2EE personal TODO. P2P sync via iroh between user's own devices. No accounts/backend. Targets: Tauri 2 desktop (mac/linux/win), Expo iOS+Android, Vite+React web.

## Stack

Desktop=Tauri 2 (Rust+iroh crate+SQLCipher/rusqlite+keyring). Web=Vite+React+Tailwind v4 (iroh-js WASM in Worker, wa-sqlite+OPFS+AES-GCM). Mobile=Expo+RN+NativeWind (iroh-ffi Expo Module, op-sqlite+SQLCipher). Core=`packages/core` pure TS, adapter ifaces. Bun workspaces monorepo; Bun=pkg mgr+runner+test runner. Node only via Metro.

## Layout

```
apps/{web,desktop,mobile}    deployable apps
packages/{core,ui}           shared libs (core=pure TS, ui=React+Tailwind)
infra/docker/                web dev container
tooling/{typescript,eslint}  shared configs
docs/                        long-form docs (ARCHITECTURE.md)
scripts/                     build/maintenance scripts
.claude/skills/              project skills (loaded on demand)
```

Top-level entry = `Makefile`. `make help` lists targets.

## Critical rules (always-on)

- No telemetry/analytics/crash-report/3rd-party SDKs phoning home. Egress ≠ iroh peers/relays → raise first.
- Never log secrets, raw Automerge changes, peer fingerprints (console/files/Tauri events).
- At-rest data encrypted. Key in platform secret store (Keychain/Cred Mgr/Secret Svc/Android Keystore) or non-extractable WebCrypto. Never read/export raw key.
- Pairing tickets single-use, 60s expiry. Post-pair auth = signature.
- Tauri allowlist: only `iroh_*`, `storage_*`, `dialog`. No `shell`/`http`/broad `fs`.
- Web CSP strict: no `unsafe-inline`, no remote scripts, `wasm-unsafe-eval` only for iroh+Automerge+SQLite WASM. Styling = Tailwind v4 classes (build-time CSS, self-origin). No inline `style={}` attrs (CSP `style-src 'self'` blocks). No `@font-face` remote URL.
- No WebTransport (Safari) → unsupported screen. No silent fallback.
- No recovery. Lost devices = lost data. "Export backup" = user-managed encrypted Automerge snapshot. Never auto-upload.
- Package mgr = bun only. Never npm/npx/pnpm/yarn (install/add/run/exec/create). Use `bun add`, `bun install`, `bun run`, `bunx`.
- Dev servers (vite/tauri/expo/metro) MUST be stopped before session end. Kill background tasks via TaskStop; verify ports free (`lsof -ti tcp:5173|tcp:1420|tcp:8081`). Never leave a server running.
- Every new feature / bug fix MUST land with unit + integration tests in the same PR. See `todo-testing` skill for layout + commands. Failing CI on missing coverage is by design.

## Skills (load on demand)

- `todo-commands` — make/bun/cargo/eas command reference
- `todo-architecture` — UI split, adapters, pairing, runtime adapter pick
- `todo-conventions` — core purity, error surfacing, migrations, screen placement, config locations
- `todo-security` — full security/privacy rationale + edge cases
- `todo-design` — Things3 (Cultured Code) dark aesthetic; design tokens, components, screens, audit
- `todo-testing` — bun test + happy-dom + Playwright conventions, mandatory unit + integration test on every feature/fix

## Self-maintenance (append-on-learn)

Major project fact learned → persist immediately, no ask.

**Major** = new stack/tool, new convention/invariant, new command/workflow, architecture decision, security rule change, recurring external resource (dashboard/URL), bug w/ non-obvious cause+fix, stakeholder/deadline shaping scope.

**Not major (skip)**: paths derivable by `ls`/`grep`, one-off task state, patterns visible in source, anything in `git log`.

**Route**:
- Always-on critical rule (security/network/data-loss) → CLAUDE.md "Critical rules"
- Command → `todo-commands`
- Arch/adapter/sync/pairing → `todo-architecture`
- Code convention → `todo-conventions`
- Security detail/rationale → `todo-security`
- Testing convention/pattern → `todo-testing`
- Doesn't fit + recurring → new skill `.claude/skills/todo-<topic>/SKILL.md` + add to "Skills" list

**How**: 1-line caveman entry. Edit existing, no dupes. Contradicts existing → update, don't append. Frontmatter `description` must stay accurate (loads on desc match).

**Skip writing if**: user says "don't remember", info ephemeral, already in `git log`/source, unsure (verify first).
