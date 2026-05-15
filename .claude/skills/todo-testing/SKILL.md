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
- Browser integration = Playwright (Chromium). Real OPFS/IndexedDB/WebCrypto.

## WHERE tests live

- `packages/core/__tests__/<mirror>.test.ts` — pure logic, NO DOM imports
- `packages/core/__tests__/helpers/` — `MemStorage`, `MemTransport`, `FakePeer`
- `packages/core/__tests__/adapters/contract.ts` — reusable adapter conformance suite
- `packages/ui/__tests__/<mirror>.test.tsx` — component+hook+lib
- `packages/ui/__tests__/helpers/` — `FakeEngine`, `renderWithStore`
- `apps/web/__tests__/<mirror>.test.tsx` — adapter pure logic + Splash/ErrorScreen
- `apps/web/e2e/*.spec.ts` — Playwright (uses Playwright's `test` from `./fixtures/page`)
- No co-located `*.test.tsx` in `src/`. Mirror trees only.

## WHEN to add tests (hard rule)

- **Every feature** → unit test same PR. Component → render + 1 interaction. Logic → happy + ≥1 edge.
- **Every bug fix** → regression test FIRST (red), then patch (green).
- **Every new adapter impl** → must pass `storageAdapterContract` from `packages/core/__tests__/adapters/contract.ts`.
- **Every migration step** → v(N−1)→v(N) test in `migrations.test.ts`.
- **Every Automerge mutation** → regression for 2 known gotchas (no `undefined` values, no self-reassign of existing obj props).

## WHAT per layer

- **core**: every exported `TodoStore`/`SyncEngine` method; Automerge edges; adapter contract; migrations.
- **ui**: render+interaction via role/label. Provider tests use `FakeEngine`. NEVER mock `useStore` — wrap in `StoreProvider` w/ fake engine.
- **web unit**: pure-logic only (transport stubs, error screens). NEVER mock OPFS/IDB/WebCrypto — push to Playwright.
- **web e2e**: drive real UI. Persistence via reload. Use fixture `apps/web/e2e/fixtures/page.ts` (cleans OPFS+IDB before each).

## Test patterns

- In-memory: `MemStorage`+`MemTransport` from `packages/core/__tests__/helpers/`. Spy-style counters on `MemStorage` (`saveDocCalls`, `appendCalls`, `truncateCalls`, `failNext.*`).
- `FakeEngine` (`packages/ui/__tests__/helpers/fakeEngine.ts`) wraps real `TodoStore`, records `commits`. `engine.injectRemote(peer, bytes)` simulates sync.
- `renderWithStore(ui, { engine })` (`packages/ui/__tests__/helpers/renderWithStore.tsx`) mounts inside `<StoreProvider>` w/ fake engine.
- Test seams via injection, not module mocking. e.g. `Splash`/`ErrorScreen` exported from `apps/web/src/App.tsx`.
- Playwright fixture clears `navigator.storage.getDirectory()` entries + `indexedDB.deleteDatabase('todo-p2p-keys')` via `addInitScript` pre-navigation.

## Commands

| Command | What |
|---|---|
| `bun test` | All workspaces unit |
| `bun --filter @todo-p2p/core test` | core |
| `bun --filter @todo-p2p/ui test` | ui |
| `bun --filter @todo-p2p/web test` | web unit |
| `bun run test:e2e` | Playwright (auto vite preview) |
| `make test` / `make test-e2e` | Same |
| `bun --filter @todo-p2p/ui test Modal` | Single file |

## Coverage bar

- Every exported fn/class ≥1 happy + ≥1 edge.
- Every adapter method = roundtrip integration (contract or Playwright).
- Every screen ≥1 render + ≥1 interaction.
- Every migration step = v(N−1)→v(N) test.

## Anti-patterns (forbidden)

- ❌ Snapshot tests (`toMatchSnapshot`/`toMatchInlineSnapshot`). Brittle.
- ❌ Mocking Automerge internals. Test through `TodoStore` API.
- ❌ Mocking fetch/network. No egress; if test wants it, design wrong.
- ❌ Testing private state. Assert observable (DOM, events, return values).
- ❌ Co-located `*.test.tsx` in `src/`. Mirror tree only.
- ❌ jsdom. Use happy-dom.
- ❌ Leaving `vite preview` after Playwright. `webServer` in `playwright.config.ts` auto-stops.
- ❌ Exposing internal adapters (`WebStorageAdapter`/`WebSecureKeyStore`) on `window` in prod — security regression.

## Security cross-ref

- Tests MUST NOT make network requests. Allowed = `file:` + `http://localhost` from Playwright fixture only.
- Test artifacts gitignored: `apps/web/test-results/`, `apps/web/playwright-report/`, `apps/web/playwright/.cache/`.
- Never log secrets/peer fingerprints in test output.
- Non-extractable CryptoKey invariant: keystore test MUST assert `crypto.subtle.exportKey('raw', key)` rejects.

## Known gaps (regression targets)

- `apps/web/e2e/app.spec.ts` has `.skip`'d persistence test. Cause: `SyncEngine.open()` creates fresh Automerge actor when no snapshot exists → replaying changes log silently no-ops. Fix = persist snapshot on first commit. Un-skip when fixed.
- No direct unit tests for `WebStorageAdapter` AES-GCM seal/open. Covered indirectly by skipped persistence e2e. Add Playwright-driven once dev-only test-only adapter expose path built (gated, NOT in prod).
