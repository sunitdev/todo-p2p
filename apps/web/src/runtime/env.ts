/**
 * Runtime capability detection. Lives here (not App.tsx) so both `App` and the
 * runtime factory can import it without a cycle.
 */

/**
 * WebTransport is required for the web target's iroh transport. Per CLAUDE.md we
 * never silently fall back — Safari and other browsers without WebTransport land
 * on the Unsupported screen.
 */
export function hasWebTransport(globalRef: unknown = globalThis): boolean {
  const g = globalRef as { WebTransport?: unknown };
  return typeof g.WebTransport === 'function';
}

/**
 * Tauri desktop loads this same web bundle inside WKWebView/WebView2, which
 * lacks WebTransport on macOS. Desktop runs iroh natively via Rust, so the
 * WebTransport gate must not apply. Detect Tauri via the injected internals
 * global.
 */
export function isTauri(globalRef: unknown = globalThis): boolean {
  const g = globalRef as { __TAURI_INTERNALS__?: unknown };
  return g.__TAURI_INTERNALS__ != null;
}
