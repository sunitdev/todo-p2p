import { useEffect, useState } from 'react';
import { SyncEngine } from '@todo-p2p/core';
import { Home, StoreProvider } from '@todo-p2p/ui';
import { WebStorageAdapter } from './storage/webStorage';
import { NullTransport } from './runtime/nullTransport';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; engine: SyncEngine }
  | { kind: 'error'; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
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
  if (state.kind === 'error') return <ErrorScreen message={state.message} />;
  return (
    <StoreProvider engine={state.engine}>
      <Home />
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
