import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecurrencePicker } from '../../src/components/RecurrencePicker';

afterEach(cleanup);

describe('RecurrencePicker', () => {
  test('renders all four kind chips and an interval input', () => {
    render(
      <RecurrencePicker
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Year' })).toBeInTheDocument();
    expect(screen.getByLabelText('Repeat interval')).toBeInTheDocument();
  });

  test('selecting Week emits weekly recurrence with interval=1', () => {
    const onChange = mock();
    render(<RecurrencePicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'weekly', interval: 1 });
  });

  test('selecting Day emits daily recurrence', () => {
    const onChange = mock();
    render(<RecurrencePicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'daily', interval: 1 });
  });

  test('seed value pre-selects the matching kind chip', () => {
    render(
      <RecurrencePicker
        value={{ kind: 'monthly', interval: 2 }}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Month' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      (screen.getByLabelText('Repeat interval') as HTMLInputElement).value,
    ).toBe('2');
  });

  test('changing the interval field re-emits with the new value', async () => {
    const user = userEvent.setup();
    const onChange = mock();
    render(
      <RecurrencePicker value={{ kind: 'weekly', interval: 1 }} onChange={onChange} />,
    );
    const input = screen.getByLabelText('Repeat interval') as HTMLInputElement;
    await user.tripleClick(input);
    await user.keyboard('3');
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last).toEqual({ kind: 'weekly', interval: 3 });
  });

  test('Never button emits null', () => {
    const onChange = mock();
    render(
      <RecurrencePicker value={{ kind: 'weekly', interval: 1 }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Never' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('non-positive interval is clamped to 1', async () => {
    const user = userEvent.setup();
    const onChange = mock();
    render(
      <RecurrencePicker value={{ kind: 'weekly', interval: 2 }} onChange={onChange} />,
    );
    const input = screen.getByLabelText('Repeat interval') as HTMLInputElement;
    await user.tripleClick(input);
    await user.keyboard('0');
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last).toEqual({ kind: 'weekly', interval: 1 });
  });
});
