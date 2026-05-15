import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect(): void;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    // CSSOM property setters — not blocked by `style-src 'self'` (CSP3 covers
    // setAttribute('style') and inline <style>, not per-property mutations).
    el.style.left = `${Math.min(x, vw - rect.width - 8)}px`;
    el.style.top = `${Math.min(y, vh - rect.height - 8)}px`;
  }, [x, y]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed left-0 top-0 z-50 min-w-[180px] rounded-2 border border-separator bg-bg-l1 shadow-ambient py-1"
    >
      {items.map((it, i) => (
        <button
          key={i}
          role="menuitem"
          onClick={() => {
            it.onSelect();
            onClose();
          }}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-1.5 text-callout text-left transition-colors',
            it.destructive ? 'text-red hover:bg-red/10' : 'text-label hover:bg-label/5',
          )}
        >
          {it.icon && <span className="size-4 shrink-0">{it.icon}</span>}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
