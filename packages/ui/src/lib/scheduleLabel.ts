import type { Todo } from '@todo-p2p/core';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const WEEKDAY_SHORT = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const MONTH_DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export type SchedulePillKind =
  | 'today'
  | 'today-evening'
  | 'someday'
  | 'date-today'
  | 'date-tomorrow'
  | 'date-weekday'
  | 'date-future'
  | 'date-overdue';

export interface SchedulePill {
  label: string;
  /** Tailwind text-color class. */
  tint: string;
  kind: SchedulePillKind;
}

/**
 * Resolves a `Todo`'s schedule into a single trailing pill descriptor, or
 * `null` when no pill should render (default `'anytime'` / no schedule).
 * Caller picks colour from `tint`; pure data — no JSX. Time argument is
 * injected so tests can pin "now".
 */
export function deriveSchedulePill(
  todo: Pick<Todo, 'scheduledWhen' | 'scheduledFor' | 'eveningOnToday' | 'done'>,
  now: number = Date.now(),
): SchedulePill | null {
  if (typeof todo.scheduledFor === 'number') {
    const today = startOfDay(now);
    const target = startOfDay(todo.scheduledFor);
    const days = Math.round((target - today) / MS_PER_DAY);
    if (days < 0) {
      return {
        label: MONTH_DAY.format(new Date(todo.scheduledFor)),
        tint: todo.done ? 'text-label-tertiary' : 'text-red',
        kind: 'date-overdue',
      };
    }
    if (days === 0) {
      return { label: 'Today', tint: 'text-yellow', kind: 'date-today' };
    }
    if (days === 1) {
      return { label: 'Tomorrow', tint: 'text-tint', kind: 'date-tomorrow' };
    }
    if (days < 7) {
      return {
        label: WEEKDAY_SHORT.format(new Date(todo.scheduledFor)),
        tint: 'text-tint',
        kind: 'date-weekday',
      };
    }
    return {
      label: MONTH_DAY.format(new Date(todo.scheduledFor)),
      tint: 'text-tint',
      kind: 'date-future',
    };
  }
  if (todo.scheduledWhen === 'today') {
    if (todo.eveningOnToday) {
      return { label: 'Today, Evening', tint: 'text-yellow', kind: 'today-evening' };
    }
    return { label: 'Today', tint: 'text-yellow', kind: 'today' };
  }
  if (todo.scheduledWhen === 'someday') {
    return { label: 'Someday', tint: 'text-tan', kind: 'someday' };
  }
  return null;
}

export type DeadlineState = 'overdue' | 'today' | 'future' | null;

/**
 * Resolves a `Todo.dueDate` into a deadline severity. Returns `null` when no
 * indicator should render (done, or no due date). "future" doesn't render the
 * flag because the scheduled-date pill already conveys the upcoming work.
 */
export function deriveDeadline(
  todo: Pick<Todo, 'dueDate' | 'done'>,
  now: number = Date.now(),
): DeadlineState {
  if (todo.done) return null;
  if (typeof todo.dueDate !== 'number') return null;
  const today = startOfDay(now);
  const target = startOfDay(todo.dueDate);
  if (target < today) return 'overdue';
  if (target === today) return 'today';
  return 'future';
}

/** Formatter for the small "due MMM D" label adjacent to the deadline flag. */
export function formatDueShort(ms: number): string {
  return MONTH_DAY.format(new Date(ms));
}
