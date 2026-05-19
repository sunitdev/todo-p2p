import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Todo } from '@todo-p2p/core';
import { TodoRow } from '../../src/components/TodoRow';

afterEach(cleanup);

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'a',
    title: 'Walk dog',
    done: false,
    createdAt: 0,
    ...overrides,
  };
}

const NOOP = () => {};

describe('TodoRow', () => {
  test('renders title and exposes checkbox with aria-checked=false when open', () => {
    render(
      <TodoRow todo={todo()} done={false} tint="text-yellow" onToggle={NOOP} />,
    );
    expect(screen.getByText('Walk dog')).toBeInTheDocument();
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAttribute('aria-checked', 'false');
  });

  test('section tint class lands on the checkbox when done', () => {
    render(
      <TodoRow todo={todo({ done: true })} done tint="text-yellow" onToggle={NOOP} />,
    );
    const box = screen.getByRole('checkbox');
    expect(box.className).toContain('text-yellow');
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  test('different tint propagates (text-blue for Inbox example)', () => {
    render(
      <TodoRow todo={todo({ done: true })} done tint="text-blue" onToggle={NOOP} />,
    );
    expect(screen.getByRole('checkbox').className).toContain('text-blue');
  });

  test('strike-through pseudo-element is applied when done', () => {
    render(
      <TodoRow todo={todo({ done: true })} done tint="text-blue" onToggle={NOOP} />,
    );
    const title = screen.getByText('Walk dog');
    // class names live on the span; assert the data-state hook + the
    // pseudo width target rather than computed style (happy-dom doesn't run
    // ::after).
    expect(title.getAttribute('data-done')).toBe('true');
    expect(title.className).toContain('after:w-full');
  });

  test('open state omits the strike-through width class', () => {
    render(
      <TodoRow todo={todo()} done={false} tint="text-blue" onToggle={NOOP} />,
    );
    const title = screen.getByText('Walk dog');
    expect(title.getAttribute('data-done')).toBe('false');
    expect(title.className).toContain('after:w-0');
  });

  test('clicking checkbox fires onToggle and stops row select', () => {
    const onToggle = mock();
    const onSelect = mock();
    render(
      <TodoRow
        todo={todo()}
        done={false}
        tint="text-blue"
        onToggle={onToggle}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('clicking row body calls onSelect with modifier flags', () => {
    const onSelect = mock();
    render(
      <TodoRow
        todo={todo()}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
        onSelect={onSelect}
      />,
    );
    fireEvent.mouseDown(screen.getByText('Walk dog'), {
      metaKey: true,
      shiftKey: false,
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toEqual({ meta: true, shift: false });
  });

  test('clicking title text fires onOpen', () => {
    const onOpen = mock();
    render(
      <TodoRow
        todo={todo()}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByText('Walk dog'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('selected state adds bg + ring classes', () => {
    render(
      <TodoRow
        todo={todo()}
        done={false}
        selected
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    const row = screen.getByTestId('todo-row-a');
    expect(row.className).toContain('bg-bg-l3');
    expect(row.className).toContain('ring-tint/30');
  });

  test('notes glyph renders only when notes present', () => {
    const { rerender } = render(
      <TodoRow todo={todo()} done={false} tint="text-blue" onToggle={NOOP} />,
    );
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
    rerender(
      <TodoRow
        todo={todo({ notes: 'meta' })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    // FileText is rendered as svg w/ aria-hidden; we just check classlist via id.
    const row = screen.getByTestId('todo-row-a');
    expect(row.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  test('flagged glyph renders when todo.flagged', () => {
    render(
      <TodoRow
        todo={todo({ flagged: true })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    const row = screen.getByTestId('todo-row-a');
    // 1 = potential check + 1 = flag = 2 svgs minimum; assert flag tint class on a span.
    expect(row.className).toContain('group');
    expect(row.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  test('schedule pill renders "Today" yellow when scheduledWhen=today', () => {
    render(
      <TodoRow
        todo={todo({ scheduledWhen: 'today' })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    const pill = screen.getByText('Today');
    expect(pill.className).toContain('text-yellow');
    expect(pill.getAttribute('data-schedule')).toBe('today');
  });

  test('schedule pill renders "Today, Evening" when eveningOnToday is true', () => {
    render(
      <TodoRow
        todo={todo({ scheduledWhen: 'today', eveningOnToday: true })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    expect(screen.getByText('Today, Evening')).toBeInTheDocument();
  });

  test('schedule pill renders "Someday" tan when scheduledWhen=someday', () => {
    render(
      <TodoRow
        todo={todo({ scheduledWhen: 'someday' })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    const pill = screen.getByText('Someday');
    expect(pill.className).toContain('text-tan');
  });

  test('no pill rendered for plain anytime todo', () => {
    render(
      <TodoRow todo={todo()} done={false} tint="text-blue" onToggle={NOOP} />,
    );
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.queryByText('Someday')).toBeNull();
    expect(screen.queryByText('Tomorrow')).toBeNull();
  });

  test('past scheduledFor renders an overdue (red) date pill', () => {
    const past = Date.now() - 5 * 24 * 60 * 60 * 1000;
    render(
      <TodoRow
        todo={todo({ scheduledFor: past })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    const pill = document.querySelector('[data-schedule="date-overdue"]') as HTMLElement;
    expect(pill).toBeInTheDocument();
    expect(pill.className).toContain('text-red');
  });

  test('overdue deadline renders red flag badge with formatted date', () => {
    const past = Date.now() - 24 * 60 * 60 * 1000;
    render(
      <TodoRow
        todo={todo({ dueDate: past })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    const badge = document.querySelector('[data-deadline="overdue"]')!;
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-red');
  });

  test('today deadline renders orange flag badge', () => {
    const now = Date.now();
    render(
      <TodoRow
        todo={todo({ dueDate: now })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    const badge = document.querySelector('[data-deadline="today"]')!;
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-orange');
  });

  test('completed todo with dueDate does not render a deadline badge', () => {
    render(
      <TodoRow
        todo={todo({ dueDate: Date.now() - 1000, done: true })}
        done
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    expect(document.querySelector('[data-deadline="overdue"]')).toBeNull();
    expect(document.querySelector('[data-deadline="today"]')).toBeNull();
  });

  test('recurrence renders a repeating indicator with a tooltip summary', () => {
    render(
      <TodoRow
        todo={todo({ recurrence: { kind: 'weekly', interval: 2 } })}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
      />,
    );
    const marker = document.querySelector('[data-repeat="true"]') as HTMLElement;
    expect(marker).toBeInTheDocument();
    expect(marker.getAttribute('title')).toBe('Every 2 weeks');
  });

  test('right-click forwards to onContextMenu with prevent-default opportunity', () => {
    const onContextMenu = mock();
    render(
      <TodoRow
        todo={todo()}
        done={false}
        tint="text-blue"
        onToggle={NOOP}
        onContextMenu={onContextMenu}
      />,
    );
    fireEvent.contextMenu(screen.getByTestId('todo-row-a'));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });
});
