import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { SyncEngine } from '@todo-p2p/core';
import {
  Home,
  Pairing,
  QUICK_ENTRY_OPEN_EVENT,
  Settings,
  StoreProvider,
  Unsupported,
} from '@todo-p2p/ui';
import { WebStorageAdapter } from './storage/webStorage';
import { NullTransport } from './runtime/nullTransport';

/**
 * Tauri global-shortcut bridge. Desktop wave wires `Cmd/Ctrl+Space` at the OS
 * level (so the panel opens even when another app is focused) and emits
 * `"quick-entry-open"`. We re-dispatch it as a window-level CustomEvent so
 * the `useCustomEvent` consumer in `Home` reacts identically whether the
 * trigger came from in-window keydown or from the Tauri bridge.
 *
 * On web (no Tauri), `window.__TAURI_INTERNALS__` is undefined and the
 * dynamic import resolves to a no-op listener. We never silently fall back to
 * a less-private channel; the only side-effect is opening the in-app panel.
 */
function useTauriQuickEntryBridge(): void {
  useEffect(() => {
    const g = globalThis as { __TAURI_INTERNALS__?: unknown };
    if (!g.__TAURI_INTERNALS__) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (cancelled) return;
        unlisten = await listen('quick-entry-open', () => {
          window.dispatchEvent(new CustomEvent(QUICK_ENTRY_OPEN_EVENT));
        });
      } catch (e) {
        // Bridge load failure is non-fatal — fall back to window-focused
        // shortcut. Logged to console (never user-facing) per CLAUDE.md.

        console.warn('[quick-entry] tauri bridge unavailable:', e);
      }
    })();
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);
}

type Route = 'home' | 'pairing' | 'settings' | 'unsupported';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; engine: SyncEngine }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

/**
 * WebTransport is required for the web target's iroh transport. Per CLAUDE.md
 * we never silently fall back — Safari and other browsers without WebTransport
 * land on the Unsupported screen. Exported for tests.
 */
export function hasWebTransport(globalRef: unknown = globalThis): boolean {
  const g = globalRef as { WebTransport?: unknown };
  return typeof g.WebTransport === 'function';
}

/**
 * Tauri desktop loads this same web bundle inside WKWebView/WebView2, which
 * lacks WebTransport on macOS. Desktop runs iroh natively via Rust, so the
 * WebTransport gate must not apply. Detect Tauri via the injected internals
 * global. Exported for tests.
 */
export function isTauri(globalRef: unknown = globalThis): boolean {
  const g = globalRef as { __TAURI_INTERNALS__?: unknown };
  return g.__TAURI_INTERNALS__ != null;
}

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [route, setRoute] = useState<Route>('home');

  useTauriQuickEntryBridge();

  useEffect(() => {
    if (!isTauri() && !hasWebTransport()) {
      setState({ kind: 'unsupported' });
      setRoute('unsupported');
      return;
    }

    let alive = true;
    let opened: SyncEngine | null = null;
    (async () => {
      try {
        const storage = await WebStorageAdapter.open();
        const transport = new NullTransport();
        const engine = await SyncEngine.open(storage, transport);
        opened = engine;
        if (!alive) {
          await engine.close();
          return;
        }
        setState({ kind: 'ready', engine });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setState({ kind: 'error', message });
      }
    })();
    return () => {
      alive = false;
      if (opened) void opened.close();
    };
  }, []);

  if (state.kind === 'loading') return <Splash />;
  if (state.kind === 'unsupported') return <Unsupported />;
  if (state.kind === 'error') return <ErrorScreen message={state.message} />;

  return (
    <StoreProvider engine={state.engine}>
      {route === 'home' && (
        <>
          <Home />
          {/*
            Settings entry point. The sidebar bottom-toolbar slot is owned by
            another agent's pass; until that lands, expose Settings via a
            fixed top-right pill. TODO P9.9: lift this into the sidebar's
            existing toolbar button once Agent E's edits are merged.
          */}
          <button
            type="button"
            aria-label="Open settings"
            onClick={() => setRoute('settings')}
            className="fixed right-4 top-3 z-30 inline-flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-bg-l3 hover:text-label"
          >
            <SettingsIcon className="size-4" />
          </button>
        </>
      )}
      {route === 'settings' && (
        <Settings
          // TODO P9.4: thread real device identity + paired peers + app version
          // from `packages/core` (DeviceIdentity, PairingState) once the
          // identity store API is settled.
          device={{ name: 'This device', id: 'unknown' }}
          pairedCount={0}
          version="0.0.0-dev"
          onPairNew={() => setRoute('pairing')}
          onExportBackup={() => {
            /* TODO P9.5: invoke encrypted Automerge export pipeline */
          }}
          onWipeDevice={() => {
            /* TODO P9.6: invoke storage wipe + identity reset */
          }}
        />
      )}
      {route === 'pairing' && (
        <Pairing
          // TODO P9.7: replace placeholders with values from the real pairing
          // adapter (PairingPayload + PairingState in @todo-p2p/core). Until
          // the adapter exists in the web runtime, render with a synthetic
          // 60s window so the countdown UI is exercised.
          payload="placeholder"
          expiresAt={Date.now() + 60_000}
          fingerprint="a3·f9·7c"
          onConfirm={() => setRoute('home')}
          onSwitchToScan={() => {
            /* TODO P9.8: open camera-scan flow */
          }}
          onRegenerate={() => setRoute('pairing')}
        />
      )}
      {(route === 'settings' || route === 'pairing') && (
        <button
          type="button"
          onClick={() => setRoute('home')}
          aria-label="Back"
          className="fixed left-4 top-3 z-30 inline-flex h-8 items-center rounded-full px-3 text-callout text-tint hover:bg-bg-l3"
        >
          ← Back
        </button>
      )}
    </StoreProvider>
  );
}

export function Splash() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-l2 text-label-secondary">
      <span className="text-callout">Opening secure store…</span>
    </div>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-l2 px-8 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-headline font-semibold text-label">Cannot start</p>
        <p className="text-callout text-label-secondary">{message}</p>
      </div>
    </div>
  );
}
