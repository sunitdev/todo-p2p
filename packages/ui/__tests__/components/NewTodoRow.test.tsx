import { afterEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Star } from 'lucide-react';
import {
  NewTodoRow,
  type NewTodoDraft,
  type ScheduleHint,
} from '../../src/components/NewTodoRow';

afterEach(cleanup);

const HINT: ScheduleHint = {
  label: 'Today',
  icon: Star,
  tint: 'text-yellow',
  fill: true,
};

function setup(overrides: {
  onCommit?: (d: NewTodoDraft) => void;
  onCancel?: () => void;
  onBlurEmpty?: () => void;
  hint?: ScheduleHint;
} = {}) {
  const onCommit = mock(overrides.onCommit ?? (() => {}));
  const onCancel = mock(overrides.onCancel ?? (() => {}));
  const onBlurEmpty = mock(overrides.onBlurEmpty ?? (() => {}));
  const utils = render(
    <>
      <button type="button">outside</button>
      <ul>
        <NewTodoRow
          scheduleHint={overrides.hint ?? HINT}
          onCommit={onCommit}
          onCancel={onCancel}
          onBlurEmpty={onBlurEmpty}
        />
      </ul>
    </>,
  );
  return { ...utils, onCommit, onCancel, onBlurEmpty };
}

describe('NewTodoRow', () => {
  test('renders title input, notes textarea, pill, and toolbar buttons', () => {
    setup();
    expect(screen.getByPlaceholderText('New To-Do')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tag' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Checklist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flag' })).toBeInTheDocument();
  });

  test('title input auto-focuses on mount', () => {
    setup();
    expect(document.activeElement).toBe(screen.getByPlaceholderText('New To-Do'));
  });

  test('pill reflects supplied schedule hint', () => {
    setup({ hint: { label: 'Someday', icon: Star, tint: 'text-tan' } });
    expect(screen.getByText('Someday')).toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  test('Checklist button is disabled', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Checklist' })).toBeDisabled();
  });

  test('Tag button click does not call onCommit', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    await user.click(screen.getByRole('button', { name: 'Tag' }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('Flag button toggles aria-pressed and tint class', async () => {
    const user = userEvent.setup();
    setup();
    const flag = screen.getByRole('button', { name: 'Flag' });
    expect(flag.getAttribute('aria-pressed')).toBe('false');
    await user.click(flag);
    expect(flag.getAttribute('aria-pressed')).toBe('true');
    expect(flag.className).toContain('text-orange');
    await user.click(flag);
    expect(flag.getAttribute('aria-pressed')).toBe('false');
    expect(flag.className).not.toContain('text-orange');
  });

  test('Escape calls onCancel and does not commit', async () => {
    const user = userEvent.setup();
    const { onCommit, onCancel } = setup();
    const input = screen.getByPlaceholderText('New To-Do');
    await user.type(input, 'abc{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('Enter in title commits with title, notes, flagged payload', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();

    const title = screen.getByPlaceholderText('New To-Do');
    const notes = screen.getByPlaceholderText('Notes');
    const flag = screen.getByRole('button', { name: 'Flag' });

    await user.type(title, 'Buy milk');
    await user.click(notes);
    await user.type(notes, 'whole, organic');
    await user.click(flag);
    title.focus();
    await user.keyboard('{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      title: 'Buy milk',
      notes: 'whole, organic',
      flagged: true,
    });
  });

  test('focus moving title -> notes within card does NOT commit', async () => {
    const user = userEvent.setup();
    const { onCommit, onBlurEmpty } = setup();
    const title = screen.getByPlaceholderText('New To-Do');
    await user.type(title, 'Walk dog');
    await user.click(screen.getByPlaceholderText('Notes'));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onBlurEmpty).not.toHaveBeenCalled();
  });

  test('focus leaving card with text commits payload', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    const title = screen.getByPlaceholderText('New To-Do');
    await user.type(title, 'Walk dog');
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ title: 'Walk dog' });
  });

  test('focus leaving card with empty title calls onBlurEmpty, not onCommit', async () => {
    const { onCommit, onBlurEmpty } = setup();
    const title = screen.getByPlaceholderText('New To-Do');
    await act(async () => {
      fireEvent.blur(title, { relatedTarget: document.body });
    });
    expect(onBlurEmpty).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('trims whitespace-only title as empty', async () => {
    const user = userEvent.setup();
    const { onCommit, onBlurEmpty } = setup();
    const title = screen.getByPlaceholderText('New To-Do');
    await user.type(title, '   ');
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onBlurEmpty).toHaveBeenCalledTimes(1);
  });

  test('omits notes/flagged from payload when unused', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    const title = screen.getByPlaceholderText('New To-Do');
    await user.type(title, 'Just a title{Enter}');
    expect(onCommit).toHaveBeenCalledWith({ title: 'Just a title' });
  });
});
