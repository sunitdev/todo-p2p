import { X } from 'lucide-react';
import { cn } from '../lib/cn';

export type ToastLevel = 'error' | 'info';

export interface ToastItem {
  id: number;
  level: ToastLevel;
  message: string;
}

/**
 * Presentational toast stack (M4 E4.2). Fixed bottom-right, stacked. Errors use
 * `role="alert"` (assertive); info uses `role="status"` (polite). Tokens only —
 * no inline `style={}` (CSP). State + lifecycle live in `ToastProvider`.
 */
export function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[360px] max-w-[92vw] flex-col gap-2">
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const isError = item.level === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={cn(
        'anim-fade-in pointer-events-auto flex items-start gap-2 rounded-3 border bg-bg-l1 px-3.5 py-2.5 shadow-elevated',
        isError ? 'border-red/40' : 'border-separator',
      )}
    >
      <p className={cn('flex-1 text-footnote', isError ? 'text-label' : 'text-label-secondary')}>
        {item.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-label-tertiary hover:bg-bg-l3 hover:text-label"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
