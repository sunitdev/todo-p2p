import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ToastViewport, type ToastItem, type ToastLevel } from '../components/Toast';

export interface ToastApi {
  /** Surface a message. Errors persist until dismissed; info auto-dismisses. */
  notify(input: { level: ToastLevel; message: string }): void;
}

const ToastCtx = createContext<ToastApi | null>(null);

/** Info toasts clear themselves after this; errors never auto-clear. */
const INFO_TTL_MS = 4000;

// Monotonic id source. Module-level (not render-derived) so we avoid
// `Date.now`/`Math.random` and keys stay stable across re-renders.
let nextId = 0;

/**
 * Toast host (M4 E4.2). Wrap the app above `StoreProvider` so the guaranteed
 * SyncEngine-error subscriber can surface failures here. Renders the viewport
 * after `children` so toasts overlay the app.
 */
export function ToastProvider({
  children,
  /** Override the info auto-dismiss delay. Primarily a test seam. */
  infoTtlMs = INFO_TTL_MS,
}: {
  children: ReactNode;
  infoTtlMs?: number;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((cur) => cur.filter((i) => i.id !== id));
  }, []);

  const notify = useCallback<ToastApi['notify']>(
    ({ level, message }) => {
      const id = nextId++;
      setItems((cur) => [...cur, { id, level, message }]);
      if (level === 'info') {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), infoTtlMs),
        );
      }
    },
    [dismiss, infoTtlMs],
  );

  // Clear any pending auto-dismiss timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

/**
 * Non-throwing variant for components that may render outside `<ToastProvider>`
 * (e.g. `StoreProvider` in standalone unit tests). Returns `null` when absent.
 */
export function useToastOptional(): ToastApi | null {
  return useContext(ToastCtx);
}
