import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker, type DatePickerValue } from '../../src/components/DatePicker';

afterEach(cleanup);

function renderPicker(overrides: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const onChange = mock();
  const onClose = mock();
  const utils = render(
    <DatePicker
      value={overrides.value ?? {}}
      onChange={overrides.onChange ?? onChange}
      onClose={overrides.onClose ?? onClose}
      anchor={overrides.anchor ?? { x: 100, y: 100 }}
    />,
  );
  return { ...utils, onChange, onClose };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDayTs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

describe('DatePicker', () => {
  test('renders the canonical shortcut row', () => {
    renderPicker();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This Evening' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomorrow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anytime' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Someday' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  test('renders a 42-cell month grid', () => {
    renderPicker();
    expect(screen.getAllByRole('gridcell').length).toBe(42);
  });

  test('clicking "Today" emits scheduledWhen=today and closes', () => {
    const onChange = mock();
    const onClose = mock();
    renderPicker({ onChange, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenCalledWith({
      scheduledWhen: 'today',
      scheduledFor: null,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking "This Evening" emits today-evening', () => {
    const onChange = mock();
    renderPicker({ onChange });
    fireEvent.click(screen.getByRole('button', { name: 'This Evening' }));
    expect(onChange).toHaveBeenCalledWith({
      scheduledWhen: 'today-evening',
      scheduledFor: null,
    });
  });

  test('clicking "Tomorrow" emits scheduledFor at start of tomorrow', () => {
    const onChange = mock();
    renderPicker({ onChange });
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0]?.[0] as DatePickerValue;
    const expected = startOfDayTs(new Date(Date.now() + MS_PER_DAY));
    expect(arg.scheduledFor).toBe(expected);
    expect(arg.scheduledWhen).toBeNull();
  });

  test('clicking "Someday" emits scheduledWhen=someday', () => {
    const onChange = mock();
    renderPicker({ onChange });
    fireEvent.click(screen.getByRole('button', { name: 'Someday' }));
    expect(onChange).toHaveBeenCalledWith({
      scheduledWhen: 'someday',
      scheduledFor: null,
    });
  });

  test('clicking "Clear" emits null fields', () => {
    const onChange = mock();
    renderPicker({ onChange, value: { scheduledWhen: 'today' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith({
      scheduledWhen: null,
      scheduledFor: null,
    });
  });

  test('"Clear date" footer button clears every field', () => {
    const onChange = mock();
    renderPicker({
      onChange,
      value: {
        scheduledWhen: 'today',
        scheduledFor: Date.now(),
        recurrence: { kind: 'weekly', interval: 1 },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));
    expect(onChange).toHaveBeenCalledWith({
      scheduledWhen: null,
      scheduledFor: null,
      recurrence: null,
    });
  });

  test('previous-month button changes the month header label', async () => {
    const user = userEvent.setup();
    renderPicker();
    const heading = screen.getByRole('dialog').querySelector('span.font-semibold')!;
    const before = heading.textContent;
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    const after = heading.textContent;
    expect(after).not.toBe(before);
  });

  test('next-month button changes the month header label', async () => {
    const user = userEvent.setup();
    renderPicker();
    const heading = screen.getByRole('dialog').querySelector('span.font-semibold')!;
    const before = heading.textContent;
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    const after = heading.textContent;
    expect(after).not.toBe(before);
  });

  test('clicking a date cell emits scheduledFor', () => {
    const onChange = mock();
    renderPicker({ onChange });
    // Pick the cell labelled today (deterministic since the grid covers now)
    const today = new Date();
    const label = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    fireEvent.click(screen.getByRole('gridcell', { name: label }));
    const arg = onChange.mock.calls[0]?.[0] as DatePickerValue;
    expect(arg.scheduledFor).toBe(startOfDayTs(today));
    expect(arg.scheduledWhen).toBeNull();
  });

  test('Escape calls onClose', () => {
    const onClose = mock();
    renderPicker({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('toggling the Repeat row reveals the RecurrencePicker', async () => {
    const user = userEvent.setup();
    renderPicker();
    expect(screen.queryByRole('dialog', { name: 'Repeat' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Repeat/ }));
    expect(screen.getByRole('dialog', { name: 'Repeat' })).toBeInTheDocument();
  });

  test('selecting a recurrence kind bubbles up onChange with the new recurrence', async () => {
    const user = userEvent.setup();
    const onChange = mock();
    renderPicker({ onChange, value: { scheduledWhen: 'today' } });
    await user.click(screen.getByRole('button', { name: /Repeat/ }));
    await user.click(screen.getByRole('button', { name: 'Week' }));
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0] as DatePickerValue;
    expect(last.recurrence).toEqual({ kind: 'weekly', interval: 1 });
  });
});
