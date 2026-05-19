import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Recurrence } from '@todo-p2p/core';
import { cn } from '../lib/cn';

const KINDS: { kind: Recurrence['kind']; label: string; unit: string }[] = [
  { kind: 'daily', label: 'Day', unit: 'day' },
  { kind: 'weekly', label: 'Week', unit: 'week' },
  { kind: 'monthly', label: 'Month', unit: 'month' },
  { kind: 'yearly', label: 'Year', unit: 'year' },
];

export interface RecurrencePickerProps {
  value: Recurrence | null;
  onChange(next: Recurrence | null): void;
  /** Optional viewport-anchored popover. When omitted, renders inline. */
  anchor?: { x: number; y: number };
  onClose?(): void;
}

/**
 * Things3-style repeat picker. When `anchor` is provided we render as a
 * fixed-positioned popover (CSP-safe: uses CSSOM `style.left/top` setters
 * rather than the `style={}` prop, matching `ContextMenu`). Without `anchor`
 * the component renders inline, used for embedding inside larger panels.
 */
export function RecurrencePicker({
  value,
  onChange,
  anchor,
  onClose,
}: RecurrencePickerProps) {
  const [kind, setKind] = useState<Recurrence['kind']>(value?.kind ?? 'weekly');
  const [interval, setInterval] = useState<number>(value?.interval ?? 1);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    el.style.left = `${Math.min(anchor.x, vw - rect.width - 8)}px`;
    el.style.top = `${Math.min(anchor.y, vh - rect.height - 8)}px`;
  }, [anchor]);

  useEffect(() => {
    if (!anchor || !onClose) return;
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
  }, [anchor, onClose]);

  const apply = (nextKind: Recurrence['kind'], nextInterval: number) => {
    const safe = Math.max(1, Math.floor(nextInterval || 1));
    onChange({ kind: nextKind, interval: safe });
  };

  const handleKind = (k: Recurrence['kind']) => {
    setKind(k);
    apply(k, interval);
  };

  const handleInterval = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    const clamped = Number.isFinite(n) && n > 0 ? n : 1;
    setInterval(clamped);
    apply(kind, clamped);
  };

  const handleNever = () => {
    onChange(null);
    onClose?.();
  };

  const unitLabel =
    KINDS.find((k) => k.kind === kind)?.unit ?? 'week';
  const pluralUnit = interval === 1 ? unitLabel : `${unitLabel}s`;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Repeat"
      className={cn(
        anchor && 'fixed left-0 top-0 z-50',
        'w-[240px] rounded-2 border border-separator bg-bg-l1 p-3 shadow-elevated',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold uppercase tracking-wider text-label-tertiary">
          Repeat
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex size-6 items-center justify-center rounded-full text-label-secondary hover:bg-bg-l3 hover:text-label"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1" role="group" aria-label="Repeat kind">
        {KINDS.map((k) => {
          const active = k.kind === kind && value !== null;
          return (
            <button
              key={k.kind}
              type="button"
              aria-pressed={active}
              onClick={() => handleKind(k.kind)}
              className={cn(
                'inline-flex h-7 items-center justify-center rounded-2 text-footnote font-medium transition-colors',
                active
                  ? 'bg-tint text-white'
                  : 'bg-bg-l3 text-label hover:bg-label/10',
              )}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <label className="mt-3 flex items-center gap-2 text-footnote text-label-secondary">
        <span>Every</span>
        <input
          type="number"
          min={1}
          step={1}
          value={interval}
          onChange={(e) => handleInterval(e.target.value)}
          aria-label="Repeat interval"
          className="h-7 w-14 rounded-2 bg-bg-l3 px-2 text-body text-label tabular-nums focus:outline-none focus:ring-1 focus:ring-tint"
        />
        <span className="text-label">{pluralUnit}</span>
      </label>

      <div className="mt-3 flex items-center justify-between border-t border-separator/60 pt-2">
        <button
          type="button"
          onClick={handleNever}
          className="text-footnote text-label-secondary hover:text-label hover:underline"
        >
          Never
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 items-center rounded-2 bg-tint px-3 text-footnote font-medium text-white hover:opacity-90"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
