/**
 * Global error handlers (M4 E4.1). Routes otherwise-silent `unhandledrejection`
 * and uncaught `error` events to a reporter (the toast surface) so background
 * failures become visible. Messages carry no secrets (CLAUDE.md / todo-security).
 * Returns an uninstaller for cleanup.
 */
export type ErrorReport = (input: { level: 'error' | 'info'; message: string }) => void;

export function installGlobalErrorHandlers(report: ErrorReport): () => void {
  const onRejection = (e: PromiseRejectionEvent) => {
    report({ level: 'error', message: reasonMessage(e.reason) });
  };
  const onError = (e: ErrorEvent) => {
    report({ level: 'error', message: e.message || 'An unexpected error occurred.' });
  };

  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('error', onError);

  return () => {
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('error', onError);
  };
}

function reasonMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  return 'An unexpected background error occurred.';
}
