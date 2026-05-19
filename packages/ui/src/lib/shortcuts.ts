import { useEffect } from 'react';

/**
 * Declarative keyboard-shortcut binding. Single source of truth for the app's
 * window-focused shortcuts (Cmd+N, Cmd+Space, Cmd+A, etc.). Listens on
 * `window` so it naturally respects browser focus — Cmd+Space only fires when
 * the app window is focused. The Tauri desktop wave layers a *global*
 * shortcut on top via the `global-shortcut` plugin; that handler bridges into
 * the same code path by dispatching a custom DOM event (see `useCustomEvent`).
 */
export type Shortcut = {
  /** Lowercased key name as KeyboardEvent.key reports it (e.g. 'n', 'k', ' '). */
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  /**
   * When true, the shortcut fires even when an editable element (input,
   * textarea, contenteditable) has focus. Default is false so typing in a
   * field doesn't accidentally trigger app-level commands.
   */
  evenInEditable?: boolean;
  /** When false, the shortcut is not registered. Useful for conditional binds. */
  enabled?: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function matches(e: KeyboardEvent, s: Shortcut): boolean {
  // Treat metaKey OR ctrlKey as a single "primary" modifier when either is
  // requested without the other — lets Cmd+Space on mac and Ctrl+Space on
  // win/linux share a single binding.
  if (s.meta && s.ctrl) {
    if (!e.metaKey || !e.ctrlKey) return false;
  } else if (s.meta || s.ctrl) {
    if (!(e.metaKey || e.ctrlKey)) return false;
  } else if (e.metaKey || e.ctrlKey) {
    return false;
  }
  if (Boolean(s.shift) !== e.shiftKey) return false;
  if (Boolean(s.alt) !== e.altKey) return false;
  return e.key.toLowerCase() === s.key.toLowerCase();
}

export function useShortcut(shortcut: Shortcut): void {
  useEffect(() => {
    if (shortcut.enabled === false) return;
    const onKey = (e: KeyboardEvent) => {
      if (!matches(e, shortcut)) return;
      if (!shortcut.evenInEditable && isEditableTarget(e.target)) return;
      shortcut.handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Re-bind whenever any field of `shortcut` changes — callers should
    // memoize handlers if they care about churn.
  }, [
    shortcut.key,
    shortcut.meta,
    shortcut.ctrl,
    shortcut.shift,
    shortcut.alt,
    shortcut.evenInEditable,
    shortcut.enabled,
    shortcut.handler,
  ]);
}

/**
 * Listen for a custom DOM event dispatched on `window`. Used by the Tauri
 * global-shortcut bridge: the Rust handler emits a Tauri event, the front-end
 * App listener re-dispatches it as a window CustomEvent, and components like
 * `Home` subscribe via this hook to react identically to in-window shortcuts.
 */
export function useCustomEvent(name: string, handler: () => void): void {
  useEffect(() => {
    const onEvent = () => handler();
    window.addEventListener(name, onEvent);
    return () => window.removeEventListener(name, onEvent);
  }, [name, handler]);
}

/** Event name dispatched by the Tauri global shortcut bridge. Exported so
 *  the bridge in `apps/web/src/App.tsx` and the consumer in `Home.tsx` agree. */
export const QUICK_ENTRY_OPEN_EVENT = 'todo-p2p:quick-entry-open';
