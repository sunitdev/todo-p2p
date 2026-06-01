import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Side-channel for logging (no secrets — CLAUDE.md / todo-security). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Custom fallback. `reset` clears the caught error and re-renders children. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level React error boundary (M4 E4.1). Catches render/lifecycle throws that
 * would otherwise blank the app, and shows a recoverable fallback. Wraps the
 * whole tree in `main.tsx`; covers the Tauri webview too (same web build).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <DefaultFallback error={error} />;
  }
}

function DefaultFallback({ error }: { error: Error }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-l2 px-8 text-center">
      <div className="max-w-md space-y-3">
        <p className="text-headline font-semibold text-label">Something went wrong</p>
        <p className="text-callout text-label-secondary">{error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-8 items-center rounded-full bg-tint px-4 text-callout font-medium text-white hover:opacity-90"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
