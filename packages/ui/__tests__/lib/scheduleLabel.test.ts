import { describe, expect, test } from 'bun:test';
import {
  deriveDeadline,
  deriveSchedulePill,
  formatDueShort,
} from '../../src/lib/scheduleLabel';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayAt(hour = 12): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime();
}

describe('deriveSchedulePill', () => {
  test('returns null for plain anytime', () => {
    expect(deriveSchedulePill({ done: false })).toBeNull();
  });

  test('today flag becomes a yellow Today pill', () => {
    const pill = deriveSchedulePill({ scheduledWhen: 'today', done: false });
    expect(pill).toEqual({ label: 'Today', tint: 'text-yellow', kind: 'today' });
  });

  test('evening-on-today becomes a yellow "Today, Evening" pill', () => {
    const pill = deriveSchedulePill({
      scheduledWhen: 'today',
      eveningOnToday: true,
      done: false,
    });
    expect(pill?.kind).toBe('today-evening');
    expect(pill?.label).toBe('Today, Evening');
  });

  test('someday becomes a tan pill', () => {
    const pill = deriveSchedulePill({ scheduledWhen: 'someday', done: false });
    expect(pill).toEqual({ label: 'Someday', tint: 'text-tan', kind: 'someday' });
  });

  test('scheduledFor today renders Today (yellow)', () => {
    const pill = deriveSchedulePill({
      scheduledFor: todayAt(9),
      done: false,
    });
    expect(pill?.kind).toBe('date-today');
    expect(pill?.label).toBe('Today');
  });

  test('scheduledFor tomorrow renders Tomorrow (tint)', () => {
    const pill = deriveSchedulePill({
      scheduledFor: todayAt(9) + MS_PER_DAY,
      done: false,
    });
    expect(pill?.kind).toBe('date-tomorrow');
    expect(pill?.label).toBe('Tomorrow');
  });

  test('scheduledFor within 7 days renders weekday label', () => {
    const pill = deriveSchedulePill({
      scheduledFor: todayAt(9) + 3 * MS_PER_DAY,
      done: false,
    });
    expect(pill?.kind).toBe('date-weekday');
    expect(pill?.label.length).toBeGreaterThan(0);
  });

  test('scheduledFor 30 days out renders date-future', () => {
    const pill = deriveSchedulePill({
      scheduledFor: todayAt(9) + 30 * MS_PER_DAY,
      done: false,
    });
    expect(pill?.kind).toBe('date-future');
    expect(pill?.tint).toBe('text-tint');
  });

  test('scheduledFor in the past renders date-overdue red', () => {
    const pill = deriveSchedulePill({
      scheduledFor: todayAt(9) - 5 * MS_PER_DAY,
      done: false,
    });
    expect(pill?.kind).toBe('date-overdue');
    expect(pill?.tint).toBe('text-red');
  });

  test('overdue but completed renders tertiary (no alarm)', () => {
    const pill = deriveSchedulePill({
      scheduledFor: todayAt(9) - 5 * MS_PER_DAY,
      done: true,
    });
    expect(pill?.tint).toBe('text-label-tertiary');
  });
});

describe('deriveDeadline', () => {
  test('returns null when no dueDate', () => {
    expect(deriveDeadline({ done: false })).toBeNull();
  });

  test('past dueDate is overdue', () => {
    expect(deriveDeadline({ done: false, dueDate: todayAt(9) - MS_PER_DAY })).toBe('overdue');
  });

  test('dueDate today is today', () => {
    expect(deriveDeadline({ done: false, dueDate: todayAt(9) })).toBe('today');
  });

  test('future dueDate is future', () => {
    expect(deriveDeadline({ done: false, dueDate: todayAt(9) + 7 * MS_PER_DAY })).toBe('future');
  });

  test('done todo returns null even with overdue dueDate', () => {
    expect(deriveDeadline({ done: true, dueDate: todayAt(9) - MS_PER_DAY })).toBeNull();
  });
});

describe('formatDueShort', () => {
  test('non-empty', () => {
    expect(formatDueShort(Date.UTC(2024, 4, 28)).length).toBeGreaterThan(0);
  });
});
