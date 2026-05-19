# @todo-p2p/mobile

Expo + React Native + NativeWind mobile app for todo-p2p. **Scaffold only** — UI implementation and real iroh-ffi + op-sqlite adapters land in later waves.

## Status

- Directory + config files in place.
- Tabs (Today, Inbox, Upcoming, More) + Settings = stub screens (title + "coming soon").
- `tailwind.config.js` mirrors design tokens from `packages/ui/src/styles.css`.
- Runtime adapter = in-memory stubs (no persistence, no iroh).
- **No npm/bun deps installed yet — pending user approval.**

All `.tsx` files carry a `// @ts-nocheck` header until deps land; `tsconfig.json` has empty `include` so repo typecheck is unaffected.

## Intended dependencies (pending approval)

When approved, add via `bun add` (NEVER npm/npx/pnpm/yarn — see CLAUDE.md). All version pins are exact (`bunfig.toml` enforces `install.exact = true`).

### Runtime

| Package | Version | Why |
|---------|---------|-----|
| `expo` | `~52.0.0` | RN toolchain |
| `expo-router` | `~4.0.0` | file-based routing (`app/` dir) |
| `expo-status-bar` | `~2.0.0` | status bar tint w/ system theme |
| `react` | `18.3.1` | match web/desktop |
| `react-native` | `0.76.0` | Expo SDK 52 RN baseline |
| `react-native-safe-area-context` | `~4.12.0` | notch / island insets |
| `react-native-screens` | `~4.1.0` | native nav containers (expo-router peer) |
| `react-native-gesture-handler` | `~2.20.0` | swipe-to-complete, long-press multi-select |
| `react-native-reanimated` | `~3.16.0` | NativeWind peer + future row/check anims |
| `nativewind` | `^4.0.0` | Tailwind classes on RN primitives |
| `lucide-react-native` | `^0.460.0` | icon parity w/ web (`lucide-react`) per `todo-conventions` |
| `react-native-svg` | `15.8.0` | `lucide-react-native` peer |
| `@todo-p2p/core` | `workspace:*` | shared CRDT / sync engine / types |

### Dev

| Package | Version | Why |
|---------|---------|-----|
| `@babel/core` | `^7.25.0` | babel-preset-expo peer |
| `@types/react` | `18.3.12` | match web |
| `tailwindcss` | `^3.4.0` | **NativeWind v4 requires Tailwind 3, NOT v4** |
| `typescript` | `5.6.3` | match repo |

### Deferred to follow-up waves (not in this scaffold)

- `iroh-ffi` Expo Module (P2P transport — separate native task)
- `@op-engineering/op-sqlite` w/ SQLCipher (encrypted storage)
- `expo-secure-store` (Keychain / Android Keystore)

### Tailwind 3 vs 4 — known constraint

Web/desktop use Tailwind v4 with CSS `@theme` in `packages/ui/src/styles.css`. NativeWind v4 does not yet support Tailwind v4, so mobile carries a parallel **Tailwind 3** config (`tailwind.config.js`) that mirrors the same tokens. Keep the two in sync by hand on token changes.

## Bootstrap (after approval)

```sh
# From repo root
bun install                                 # installs the new mobile deps
bun --filter @todo-p2p/mobile start         # Metro
bun --filter @todo-p2p/mobile ios           # iOS simulator (requires Xcode)
bun --filter @todo-p2p/mobile android       # Android emulator
# Device builds:
bunx eas build --profile development --platform ios
bunx eas build --profile development --platform android
```

Expo dev client only (NOT Expo Go) — required for the native iroh-ffi module once it lands.

**Important**: stop Metro before session end. `lsof -ti tcp:8081` to verify (CLAUDE.md).

## Layout

```
apps/mobile/
├── package.json            # @todo-p2p/mobile; intended deps in _pendingDependencies
├── tsconfig.json           # noop placeholder (include: []) until deps install
├── app.json                # Expo config
├── babel.config.js         # NativeWind + reanimated (post-install)
├── metro.config.js         # NativeWind v4 metro wiring (post-install)
├── tailwind.config.js      # mirrors packages/ui/src/styles.css tokens
├── global.css              # NativeWind v4 entry
├── app/                    # Expo Router screens
│   ├── _layout.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx       # Today (stub)
│   │   ├── inbox.tsx
│   │   ├── upcoming.tsx
│   │   └── more.tsx
│   └── settings.tsx
├── src/
│   ├── runtime/
│   │   └── index.ts        # in-memory stub adapter
│   └── components/         # future ui-native components land here
└── README.md
```

## Where future shared mobile components will live

Per the Phase 11 plan, RN-specific shared components will land in a new `packages/ui-native/` workspace (so iPad / tablet UI can reuse them). For now this app contains screen stubs only; promote to `packages/ui-native/` when a 2nd RN consumer appears.

## Tests

Stubs only — no tests at this stage. Per `todo-testing`, every feature/fix lands w/ unit + integration tests in the same PR. Tests will accompany the real UI port (a later wave): bun-test for unit, Detox or Playwright (RN-web) for integration — TBD.

## Architecture refs

- `CLAUDE.md` — stack invariants
- `.claude/skills/todo-architecture/SKILL.md` — adapters, sync, pairing
- `.claude/skills/todo-design/SKILL.md` + `references/tokens.md` — design tokens
- `.claude/skills/todo-conventions/SKILL.md` — icons, screens, configs
- `.claude/skills/todo-commands/SKILL.md` — bun + expo + eas commands
