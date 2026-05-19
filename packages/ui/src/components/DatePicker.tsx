import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers,
  Moon,
  Repeat,
  Star,
  X,
} from 'lucide-react';
import type { Recurrence } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { RecurrencePicker } from './RecurrencePicker';

/**
 * Logical "when" the picker can emit. `'today-evening'` is collapsed to
 * `scheduledWhen: 'today'` + `eveningOnToday: true` by the caller before
 * touching the store (the store's enum is just `'today' | 'someday' | null`).
 */
export type DatePickerWhen = 'today' | 'today-evening' | 'anytime' | 'someday';

export type DatePickerValue = {
  scheduledWhen?: DatePickerWhen | null;
  scheduledFor?: number | null;
  recurrence?: Recurrence | null;
};

export interface DatePickerProps {
  value: DatePickerValue;
  onChange(next: DatePickerValue): void;
  onClose(): void;
  /** Viewport coords (e.g. event.clientX / Y). Popover flips to stay on-screen. */
  anchor: { x: number; y: number };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Monday-first weekday index (0=Mon..6=Sun). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Build a 6×7 grid of dates whose first row starts on the Monday on/before
 * the first of the month. Rows past the month spill into the next month so
 * the grid is always 42 cells (Things3 keeps shape constant).
 */
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - mondayIndex(first));
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const WEEKDAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
const WEEKDAYS = (() => {
  // Build from a known Monday so the order is locale-agnostic but Mon-first.
  // 2024-01-01 was a Monday.
  const base = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) =>
    WEEKDAY_FMT.format(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)),
  );
})();

interface Shortcut {
  key: DatePickerWhen | 'clear';
  label: string;
  icon: typeof Star;
  tint: string;
  fill?: boolean;
}

const SHORTCUTS: Shortcut[] = [
  { key: 'today', label: 'Today', icon: Star, tint: 'text-yellow', fill: true },
  { key: 'today-evening', label: 'This Evening', icon: Moon, tint: 'text-tint' },
  { key: 'anytime', label: 'Anytime', icon: Layers, tint: 'text-teal' },
  { key: 'someday', label: 'Someday', icon: Archive, tint: 'text-tan' },
  { key: 'clear', label: 'Clear', icon: X, tint: 'text-label-secondary' },
];

/** Tomorrow shortcut sits between Today and This Evening visually. */
const TOMORROW_SHORTCUT: Shortcut = {
  key: 'today', // re-used; tomorrow uses scheduledFor, handled separately
  label: 'Tomorrow',
  icon: CalendarDays,
  tint: 'text-tint',
};

export function DatePicker({ value, onChange, onClose, anchor }: DatePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Calendar month state. Initialise to the scheduled date's month, else today.
  // The state initialiser only runs on first mount — re-renders ignore `value`,
  // so the user's chosen view month survives parent re-renders mid-edit.
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const seed =
      typeof value.scheduledFor === 'number' ? new Date(value.scheduledFor) : new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });

  // Sub-popover for the recurrence picker.
  const [recurOpen, setRecurOpen] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(anchor.x, vw - rect.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(anchor.y, vh - rect.height - 8))}px`;
  }, [anchor]);

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

  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDay =
    typeof value.scheduledFor === 'number' ? startOfDay(new Date(value.scheduledFor)) : null;

  const cells = useMemo(
    () => buildMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth()),
    [viewMonth],
  );

  const goPrev = () =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const goNext = () =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  const pickShortcut = (s: Shortcut) => {
    if (s.key === 'clear') {
      onChange({ scheduledWhen: null, scheduledFor: null });
      onClose();
      return;
    }
    onChange({ scheduledWhen: s.key, scheduledFor: null });
    onClose();
  };

  const pickTomorrow = () => {
    const t = startOfDay(new Date(today.getTime() + MS_PER_DAY));
    onChange({ scheduledFor: t.getTime(), scheduledWhen: null });
    onClose();
  };

  const pickDay = (d: Date) => {
    onChange({ scheduledFor: startOfDay(d).getTime(), scheduledWhen: null });
    onClose();
  };

  const clearAll = () => {
    onChange({ scheduledWhen: null, scheduledFor: null, recurrence: null });
    onClose();
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Schedule"
      data-testid="date-picker"
      className="fixed left-0 top-0 z-50 w-[300px] rounded-2 border border-separator bg-bg-l1 p-2 shadow-elevated"
    >
      {/* Shortcuts row */}
      <div className="flex flex-col gap-0.5" role="group" aria-label="Schedule shortcuts">
        <ShortcutRow shortcut={SHORTCUTS[0]!} onClick={() => pickShortcut(SHORTCUTS[0]!)} />
        <ShortcutRow shortcut={SHORTCUTS[1]!} onClick={() => pickShortcut(SHORTCUTS[1]!)} />
        <ShortcutRow shortcut={TOMORROW_SHORTCUT} onClick={pickTomorrow} />
        <ShortcutRow shortcut={SHORTCUTS[2]!} onClick={() => pickShortcut(SHORTCUTS[2]!)} />
        <ShortcutRow shortcut={SHORTCUTS[3]!} onClick={() => pickShortcut(SHORTCUTS[3]!)} />
        <ShortcutRow shortcut={SHORTCUTS[4]!} onClick={() => pickShortcut(SHORTCUTS[4]!)} />
      </div>

      <div className="my-2 h-px bg-separator" role="separator" />

      {/* Calendar */}
      <div className="px-1">
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={goPrev}
            className="inline-flex size-6 items-center justify-center rounded-2 text-label-secondary hover:bg-bg-l3 hover:text-label"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-footnote font-semibold text-label">
            {MONTH_FMT.format(viewMonth)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={goNext}
            className="inline-flex size-6 items-center justify-center rounded-2 text-label-secondary hover:bg-bg-l3 hover:text-label"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 pb-1" aria-hidden>
          {WEEKDAYS.map((w, i) => (
            <span
              key={i}
              className="inline-flex h-5 items-center justify-center text-caption text-label-tertiary"
            >
              {w}
            </span>
          ))}
        </div>
        <div role="grid" aria-label="Choose a date" className="grid grid-cols-7 gap-0.5">
          {cells.map((d) => {
            const isCurrentMonth = d.getMonth() === viewMonth.getMonth();
            const isToday = isSameDay(d, today);
            const isSelected = selectedDay !== null && isSameDay(d, selectedDay);
            const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return (
              <button
                key={label}
                type="button"
                role="gridcell"
                aria-label={label}
                aria-selected={isSelected}
                onClick={() => pickDay(d)}
                className={cn(
                  'inline-flex size-7 items-center justify-center rounded-2 text-footnote tabular-nums transition-colors',
                  isSelected
                    ? 'bg-tint text-white'
                    : isCurrentMonth
                      ? 'text-label hover:bg-bg-l3'
                      : 'text-label-tertiary hover:bg-bg-l3',
                  isToday && !isSelected && 'ring-1 ring-tint',
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="my-2 h-px bg-separator" role="separator" />

      {/* Reminder + Repeat sub-rows */}
      <div className="flex flex-col gap-0.5">
        <div
          aria-disabled
          className="flex h-7 items-center gap-2 rounded-2 px-2 text-footnote text-label-tertiary"
        >
          <Star className="size-3.5 text-label-tertiary" aria-hidden />
          <span>Reminders not yet supported</span>
        </div>
        <button
          type="button"
          onClick={() => setRecurOpen((v) => !v)}
          aria-expanded={recurOpen}
          className="flex h-7 items-center gap-2 rounded-2 px-2 text-footnote text-label transition-colors hover:bg-bg-l3"
        >
          <Repeat className="size-3.5 text-label-secondary" aria-hidden />
          <span className="flex-1 text-left">Repeat</span>
          <span className="text-label-tertiary">
            {value.recurrence ? recurrenceSummary(value.recurrence) : 'Never'}
          </span>
        </button>
        {recurOpen && (
          <div className="mt-1">
            <RecurrencePicker
              value={value.recurrence ?? null}
              onChange={(next) =>
                onChange({
                  scheduledWhen: value.scheduledWhen ?? null,
                  scheduledFor: value.scheduledFor ?? null,
                  recurrence: next,
                })
              }
            />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-separator/60 pt-2">
        <button
          type="button"
          onClick={clearAll}
          className="text-footnote text-label-secondary hover:text-label hover:underline"
        >
          Clear date
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 items-center rounded-2 bg-tint px-3 text-footnote font-medium text-white hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ShortcutRow({
  shortcut,
  onClick,
}: {
  shortcut: Shortcut;
  onClick(): void;
}) {
  const Icon = shortcut.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 items-center gap-2 rounded-2 px-2 text-footnote text-label transition-colors hover:bg-bg-l3"
    >
      <Icon
        className={cn('size-3.5 shrink-0', shortcut.tint)}
        fill={shortcut.fill ? 'currentColor' : 'none'}
        aria-hidden
      />
      <span>{shortcut.label}</span>
    </button>
  );
}

function recurrenceSummary(r: Recurrence): string {
  const unit = r.kind === 'daily' ? 'day'
    : r.kind === 'weekly' ? 'week'
    : r.kind === 'monthly' ? 'month'
    : 'year';
  if (r.interval === 1) {
    return r.kind === 'daily' ? 'Daily'
      : r.kind === 'weekly' ? 'Weekly'
      : r.kind === 'monthly' ? 'Monthly'
      : 'Yearly';
  }
  return `Every ${r.interval} ${unit}s`;
}

/** Exposed for trail-pill rendering. */
export function summarizeRecurrence(r: Recurrence): string {
  return recurrenceSummary(r);
}
