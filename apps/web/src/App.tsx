import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { SyncEngine, encodePairingPayload, type PairingState } from '@todo-p2p/core';
import {
  Home,
  Pairing,
  QUICK_ENTRY_OPEN_EVENT,
  Settings,
  StoreProvider,
  Unsupported,
} from '@todo-p2p/ui';
import { createRuntime } from './runtime/createRuntime';
import { PeerManager } from './runtime/peerManager';
import { PairingController } from './runtime/pairingController';
import { ScanPairing } from './screens/ScanPairing';
import { hasWebTransport, isTauri } from './runtime/env';

// Re-exported for tests that assert capability detection.
export { hasWebTransport, isTauri };

/**
 * Tauri global-shortcut bridge. Desktop wires `Cmd/Ctrl+Space` at the OS level
 * and emits `"quick-entry-open"`; we re-dispatch it as a window CustomEvent so
 * `Home` reacts identically to in-window and global triggers. No-op on web.
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

interface Ready {
  kind: 'ready';
  engine: SyncEngine;
  peers: PeerManager;
  transport: Awaited<ReturnType<typeof createRuntime>>['transport'];
  nodeId: string;
  pairing: PairingController;
}

type State =
  | { kind: 'loading' }
  | Ready
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

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
    let opened: Ready | null = null;
    (async () => {
      try {
        const { storage, transport } = await createRuntime();
        const engine = await SyncEngine.open(storage, transport);
        const peers = new PeerManager(transport, storage);
        const nodeId = await peers.start();
        const pairing = new PairingController({
          transport,
          storage,
          engine,
          onPaired: (id) => peers.trust(id),
        });
        const ready: Ready = { kind: 'ready', engine, peers, transport, nodeId, pairing };
        opened = ready;
        if (!alive) {
          await teardown(ready);
          return;
        }
        setState(ready);
      } catch (e) {
        setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
      if (opened) void teardown(opened);
    };
  }, []);

  if (state.kind === 'loading') return <Splash />;
  if (state.kind === 'unsupported') return <Unsupported />;
  if (state.kind === 'error') return <ErrorScreen message={state.message} />;

  return (
    <StoreProvider engine={state.engine} peers={() => state.peers.peers()}>
      {route === 'home' && (
        <>
          <Home />
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
          device={{ name: 'This device', id: shortId(state.nodeId) }}
          pairedCount={state.peers.count()}
          version="0.0.0-dev"
          onPairNew={() => setRoute('pairing')}
          onExportBackup={() => {
            /* TODO M3 (P9.5): encrypted Automerge export pipeline */
          }}
          onWipeDevice={() => {
            /* TODO M3 (P9.6): storage wipe + identity reset */
          }}
        />
      )}
      {route === 'pairing' && (
        <PairingFlow pairing={state.pairing} onDone={() => setRoute('home')} />
      )}
      {(route === 'settings' || route === 'pairing') && (
        <button
          type="button"
          onClick={() => {
            if (route === 'pairing') state.pairing.reset();
            setRoute('home');
          }}
          aria-label="Back"
          className="fixed left-4 top-3 z-30 inline-flex h-8 items-center rounded-full px-3 text-callout text-tint hover:bg-bg-l3"
        >
          ← Back
        </button>
      )}
    </StoreProvider>
  );
}

async function teardown(r: Ready): Promise<void> {
  await r.peers.stop();
  await r.transport.stop();
  await r.engine.close();
}

/** Short, human-glanceable form of the long iroh node id for Settings. */
function shortId(nodeId: string): string {
  const head = nodeId.slice(0, 6);
  return `${head.slice(0, 2)}·${head.slice(2, 4)}·${head.slice(4, 6)}`;
}

/**
 * Drives the pairing UI off the `PairingController` state. Host mode shows the
 * QR; scan mode opens the camera; either path lands on the fingerprint confirm.
 */
function PairingFlow({ pairing, onDone }: { pairing: PairingController; onDone: () => void }) {
  const [state, setState] = useState<PairingState>(pairing.getState());
  const [mode, setMode] = useState<'host' | 'scan'>('host');

  useEffect(() => pairing.subscribe(setState), [pairing]);

  // Begin hosting on entry; reset on leave.
  useEffect(() => {
    void pairing.host();
    return () => pairing.reset();
  }, [pairing]);

  useEffect(() => {
    if (state.kind === 'paired') onDone();
  }, [state.kind, onDone]);

  if (state.kind === 'awaiting-fingerprint-confirm' || state.kind === 'syncing') {
    const fp = state.kind === 'awaiting-fingerprint-confirm' ? state.payload.fingerprint : '';
    return (
      <FingerprintConfirm
        fingerprint={fp}
        busy={state.kind === 'syncing'}
        onConfirm={() => void pairing.confirm()}
        onReject={() => {
          pairing.reject();
          setMode('host');
          void pairing.host();
        }}
      />
    );
  }

  if (state.kind === 'failed') {
    return (
      <PairMessage
        title="Pairing failed"
        body={state.reason}
        action="Try again"
        onAction={() => {
          setMode('host');
          void pairing.host();
        }}
      />
    );
  }

  if (mode === 'scan') {
    return (
      <ScanPairing
        onScan={(raw) => void pairing.scan(raw)}
        onCancel={() => {
          setMode('host');
          void pairing.host();
        }}
      />
    );
  }

  if (state.kind === 'showing-ticket') {
    return (
      <Pairing
        payload={encodePairingPayload(state.payload)}
        expiresAt={state.expiresAt}
        fingerprint={state.payload.fingerprint}
        onConfirm={() => void pairing.confirm()}
        onSwitchToScan={() => setMode('scan')}
        onRegenerate={() => void pairing.host()}
      />
    );
  }

  return <Splash />;
}

function FingerprintConfirm({
  fingerprint,
  busy,
  onConfirm,
  onReject,
}: {
  fingerprint: string;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-l2 px-4">
      <div className="w-[480px] max-w-[92vw] rounded-4 border border-separator bg-bg-l1 p-6 text-center shadow-ambient">
        <h1 className="text-title font-bold text-label">Confirm fingerprint</h1>
        <p className="mt-1 text-callout text-label-secondary">
          Check that these words match on both devices.
        </p>
        <p className="mt-5 font-mono text-headline tracking-wide text-label">{fingerprint}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-full border border-separator px-4 text-callout text-label hover:bg-bg-l3 disabled:opacity-40"
          >
            They differ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-full bg-tint px-4 text-callout font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Syncing…' : 'They match'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PairMessage({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-l2 px-4">
      <div className="w-[480px] max-w-[92vw] rounded-4 border border-separator bg-bg-l1 p-6 text-center shadow-ambient">
        <h1 className="text-title font-bold text-label">{title}</h1>
        <p className="mt-2 text-callout text-label-secondary">{body}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex h-8 items-center rounded-full bg-tint px-4 text-callout font-medium text-white hover:opacity-90"
        >
          {action}
        </button>
      </div>
    </div>
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
