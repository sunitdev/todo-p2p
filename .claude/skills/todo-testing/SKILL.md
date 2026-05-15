---
name: todo-testing
description: todo-p2p testing conventions — bun test + happy-dom + Testing Library for unit/component, Playwright for browser integration. Use when adding tests, writing test setup, deciding where a test lives, debugging test failures, auditing coverage, or shipping a feature/fix without tests.
---

# Testing

Stack:
- Runner = `bun test` only. Never vitest/jest.
- DOM = happy-dom via `@happy-dom/global-registrator`. Wired in `packages/ui/test-setup.ts`, preloaded per-workspace via `bunfig.toml`.
- React = `@testing-library/react@16` + `@testing-library/user-event`. Query by role/label, not class.
- Matchers = `@testing-library/jest-dom` (extended onto `bun:test`'s `expect` in test-setup; types augmented via `__tests__/bun-jest-dom.d.ts`).
- Browser integration = Playwright (Chromium). Real OPFS / IndexedDB / WebCrypto.

## WHERE tests live

- `packages/core/__tests__/<mirror>.test.ts` — pure logic, NO DOM imports
- `packages/core/__tests__/helpers/` — `MemStorage`, `MemTransport`, `FakePeer`
- `packages/core/__tests__/adapters/contract.ts` — reusable adapter conformance suite
- `packages/ui/__tests__/<mirror>.test.tsx` — component + hook + lib tests
- `packages/ui/__tests__/helpers/` — `FakeEngine`, `renderWithStore`
- `apps/web/__tests__/<mirror>.test.tsx` — adapter pure logic + Splash/ErrorScreen
- `apps/web/e2e/*.spec.ts` — Playwright (uses Playwright's own `test` from `./fixtures/page`)
- No co-located `*.test.tsx` in `src/`. Mirror trees only.

## WHEN to add tests (hard rule)

- **Every new feature** → unit test in same PR. Component → render + 1 interaction. Logic → happy path + ≥1 edge.
- **Every bug fix** → regression test FIRST (red), then patch (green).
- **Every new adapter impl** → must pass `storageAdapterContract` from `packages/core/__tests__/adapters/contract.ts`.
- **Every migration step** → v(N−1)→v(N) test in `migrations.test.ts`.
- **Every Automerge mutation** → regression for the two known gotchas (no `undefined` values, no self-reassign of existing object props).

## WHAT to test per layer

- **core**: every exported `TodoStore`/`SyncEngine` method; Automerge edge cases; adapter contract; migrations.
- **ui**: render + interaction via role/label queries. Provider tests use `FakeEngine`. NEVER mock `useStore` — wrap in `StoreProvider` with a fake engine.
- **web unit**: pure-logic surface only (transport stubs, error screens). NEVER mock OPFS/IDB/WebCrypto — push that coverage to Playwright.
- **web e2e**: drive the real UI. Persistence via reload. Use the fixture in `apps/web/e2e/fixtures/page.ts` that cleans OPFS + IDB before each test.

## Test patterns

- In-memory adapters: import `MemStorage` + `MemTransport` from `packages/core/__tests__/helpers/`. Spy-style call counters live on `MemStorage` (`saveDocCalls`, `appendCalls`, `truncateCalls`, `failNext.*`).
- `FakeEngine` (`packages/ui/__tests__/helpers/fakeEngine.ts`) wraps a real `TodoStore` and records `commits`. Use `engine.injectRemote(peer, bytes)` to simulate sync events.
- `renderWithStore(ui, { engine })` (`packages/ui/__tests__/helpers/renderWithStore.tsx`) mounts children inside `<StoreProvider>` with a fake engine.
- Test seams via injection, not module mocking. Example: `Splash`/`ErrorScreen` exported from `apps/web/src/App.tsx` so they can be tested in isolation.
- Playwright fixture clears `navigator.storage.getDirectory()` entries + `indexedDB.deleteDatabase('todo-p2p-keys')` in `addInitScript` before navigation.

## Commands

| Command | What |
|---|---|
| `bun test` | All workspaces, unit only |
| `bun --filter @todo-p2p/core test` | core only |
| `bun --filter @todo-p2p/ui test` | ui only |
| `bun --filter @todo-p2p/web test` | web unit only |
| `bun run test:e2e` | Playwright (auto vite preview lifecycle) |
| `make test` / `make test-e2e` | Same |
| `bun --filter @todo-p2p/ui test Modal` | Single file |

## Coverage bar

- Every exported function/class has ≥1 happy + ≥1 edge test.
- Every adapter method has a roundtrip integration test (via contract or Playwright).
- Every screen has ≥1 render test + ≥1 user-interaction test.
- Every migration step has a v(N−1)→v(N) test.

## Anti-patterns (forbidden)

- ❌ Snapshot tests (`toMatchSnapshot`/`toMatchInlineSnapshot`). Brittle, no behavior signal.
- ❌ Mocking Automerge internals. Test through `TodoStore` API.
- ❌ Mocking fetch / network. We have NO network egress; if a test wants it, the design is wrong.
- ❌ Testing private state. Assert on observable outputs (DOM, events, return values).
- ❌ Co-located `*.test.tsx` inside `src/`. Use `__tests__/` mirror tree.
- ❌ jsdom. Use happy-dom — bun-test integration is ergonomic.
- ❌ Leaving `vite preview` running after Playwright. The `webServer` block in `playwright.config.ts` auto-stops it.
- ❌ Exposing internal adapters (`WebStorageAdapter`/`WebSecureKeyStore`) on `window` in production builds — security regression. Drive integration through the UI instead.

## Security cross-ref (todo-security)

- Tests MUST NOT make network requests. Allowed = `file:` + `http://localhost` from Playwright fixture only.
- Test artifacts ignored in git: `apps/web/test-results/`, `apps/web/playwright-report/`, `apps/web/playwright/.cache/`.
- Never log secrets / peer fingerprints inside test output — same rule as runtime.
- Non-extractable CryptoKey invariant: any future keystore test MUST assert `crypto.subtle.exportKey('raw', key)` rejects.

## Known gaps (regression targets)

- `apps/web/e2e/app.spec.ts` has a `.skip`'d persistence test. Root cause: `SyncEngine.open()` creates a fresh Automerge actor when no snapshot exists, so replaying the changes log silently no-ops. Fix is to persist a snapshot on first commit. Un-skip when fixed.
- No direct unit tests for `WebStorageAdapter` AES-GCM seal/open. Covered indirectly by the (skipped) persistence e2e. Add Playwright-driven coverage once a test-only adapter expose path is built (must be dev-only, gated, NOT in prod bundles).
