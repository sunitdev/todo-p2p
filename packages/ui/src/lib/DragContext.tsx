import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Drop-target kinds Magic Plus (and, later, a row drag) can resolve a pointer
 * coordinate into. Stays a string-union so consumers can `switch` exhaustively.
 */
export type DropTargetKind =
  | 'sidebar-section'
  | 'sidebar-project'
  | 'sidebar-area'
  | 'row-above'
  | 'row-below';

/**
 * A registered drop zone. `rect` is captured in viewport coordinates so we can
 * intersect it directly against pointer events delivered from `motion`'s drag
 * listeners. `id` is unique-per-kind and is the value handed back to the
 * caller via `onDrop` — for row drops it is `${todoId}-above|below`.
 */
export interface DropTarget {
  id: string;
  kind: DropTargetKind;
  rect: DOMRect;
}

export interface DragContextValue {
  /** Register a drop zone; returns an unregister callback. */
  registerTarget(target: DropTarget): () => void;
  /** Pointer-hit-test → the topmost registered target intersecting `(x,y)`. */
  resolveAt(x: number, y: number): DropTarget | null;
  /** The currently-hovered target during an active drag, or `null`. */
  activeTargetId: string | null;
  /** Set/clear the hovered-target indicator while a drag is in flight. */
  setActiveTargetId(id: string | null): void;
}

const DragCtx = createContext<DragContextValue | null>(null);

/**
 * Returns the registered drop target whose rect contains `(x, y)`. When more
 * than one zone overlaps (sidebar section + a row-band that happens to
 * intersect, etc.) we prefer the one with the smaller area — narrower zones
 * are more specific intents.
 */
function pickHit(targets: ReadonlyMap<string, DropTarget>, x: number, y: number): DropTarget | null {
  let best: DropTarget | null = null;
  let bestArea = Infinity;
  for (const t of targets.values()) {
    const r = t.rect;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = r.width * r.height;
    if (area < bestArea) {
      best = t;
      bestArea = area;
    }
  }
  return best;
}

export function DragProvider({ children }: { children: ReactNode }) {
  // Mutable registry — we never need to render on each register/unregister
  // (drop-target consumers own their own highlight state via `isActive`).
  const targets = useRef(new Map<string, DropTarget>());
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  const registerTarget = useCallback((target: DropTarget) => {
    targets.current.set(target.id, target);
    return () => {
      const cur = targets.current.get(target.id);
      // Only delete if the entry we registered is still the live one — guards
      // against rect-refresh updates from racing the unmount cleanup.
      if (cur === target) targets.current.delete(target.id);
    };
  }, []);

  const resolveAt = useCallback(
    (x: number, y: number) => pickHit(targets.current, x, y),
    [],
  );

  const value = useMemo<DragContextValue>(
    () => ({ registerTarget, resolveAt, activeTargetId, setActiveTargetId }),
    [registerTarget, resolveAt, activeTargetId],
  );

  return <DragCtx.Provider value={value}>{children}</DragCtx.Provider>;
}

export function useDragContext(): DragContextValue {
  const ctx = useContext(DragCtx);
  if (!ctx) {
    throw new Error('useDragContext must be used within <DragProvider>');
  }
  return ctx;
}

/**
 * Non-throwing variant — components that may render outside `<DragProvider>`
 * (e.g. unit tests for `Sidebar`/`TodoRow` that don't need drop semantics)
 * receive `null` and short-circuit their registration.
 */
export function useDragContextOptional(): DragContextValue | null {
  return useContext(DragCtx);
}

/**
 * Hook used by drop-target consumers (sidebar rows, todo-row bands). The
 * returned `ref` is attached to the host element; we measure its
 * `getBoundingClientRect()` on mount and on resize, then register/unregister
 * with the provider. `isActive` flips when this target id matches the
 * provider's `activeTargetId`, letting the caller apply a highlight class.
 *
 * Safe to call outside `<DragProvider>` — it becomes a no-op so plain
 * `<Sidebar>` unit tests don't need to wrap.
 */
export function useDropTarget(
  id: string,
  kind: DropTargetKind,
  options: { enabled?: boolean } = {},
): { ref: (el: HTMLElement | null) => void; isActive: boolean } {
  const enabled = options.enabled ?? true;
  const ctx = useDragContextOptional();
  const elRef = useRef<HTMLElement | null>(null);
  const unregRef = useRef<(() => void) | null>(null);

  /**
   * (Re)measure + (re)register. Called from the ref setter (mount + node
   * swap), from a `ResizeObserver` (layout shifts), and on viewport resize.
   * We always unregister the previous entry before registering the next so
   * stale rects don't accumulate when the row scrolls or re-renders.
   */
  const refresh = useCallback(() => {
    if (!ctx || !enabled) {
      unregRef.current?.();
      unregRef.current = null;
      return;
    }
    const el = elRef.current;
    if (!el) {
      unregRef.current?.();
      unregRef.current = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    unregRef.current?.();
    unregRef.current = ctx.registerTarget({ id, kind, rect });
  }, [ctx, enabled, id, kind]);

  // The ref setter is exposed to consumers as a stable function; React calls
  // it with `null` on unmount, which we use as our cleanup signal.
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      elRef.current = el;
      refresh();
    },
    [refresh],
  );

  // Observe size/layout changes on the host so we don't carry a stale rect
  // when the sidebar resizes or the row count shifts above us.
  useLayoutEffect(() => {
    if (!ctx || !enabled) return;
    const el = elRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => refresh());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ctx, enabled, refresh]);

  // Viewport-level changes (window resize, scroll) also invalidate the cached
  // viewport rect. Scroll is the most common one — sidebar scrolls
  // independently of the main pane.
  useEffect(() => {
    if (!ctx || !enabled) return;
    const onChange = () => refresh();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [ctx, enabled, refresh]);

  // Final cleanup — guarantees the entry is gone when the consumer unmounts
  // (e.g. the row's todo was deleted).
  useEffect(() => {
    return () => {
      unregRef.current?.();
      unregRef.current = null;
    };
  }, []);

  return {
    ref: setRef,
    isActive: enabled ? ctx?.activeTargetId === id : false,
  };
}
