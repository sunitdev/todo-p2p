import { afterEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import {
  QUICK_ENTRY_OPEN_EVENT,
  useCustomEvent,
  useShortcut,
} from '../../src/lib/shortcuts';

afterEach(cleanup);

function ShortcutHarness({
  shortcut,
  inputAutofocus = false,
}: {
  shortcut: Parameters<typeof useShortcut>[0];
  inputAutofocus?: boolean;
}) {
  useShortcut(shortcut);
  return (
    <div>
      <input data-testid="text" autoFocus={inputAutofocus} aria-label="input" />
      <button data-testid="btn">btn</button>
    </div>
  );
}

function EventHarness({
  name,
  handler,
}: {
  name: string;
  handler: () => void;
}) {
  useCustomEvent(name, handler);
  return <span>x</span>;
}

describe('useShortcut', () => {
  test('fires handler on matching keydown with meta modifier', () => {
    const handler = mock();
    render(<ShortcutHarness shortcut={{ key: 'n', meta: true, handler }} />);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true }),
      );
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('fires handler on matching keydown with ctrl when meta requested (mac/win bridge)', () => {
    const handler = mock();
    render(<ShortcutHarness shortcut={{ key: 'n', meta: true, handler }} />);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true }),
      );
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('does not fire on non-matching key', () => {
    const handler = mock();
    render(<ShortcutHarness shortcut={{ key: 'n', meta: true, handler }} />);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'm', metaKey: true, bubbles: true }),
      );
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test('does not fire when modifier missing', () => {
    const handler = mock();
    render(<ShortcutHarness shortcut={{ key: 'n', meta: true, handler }} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test('does not fire while focus is in an input by default', () => {
    const handler = mock();
    const { getByTestId } = render(
      <ShortcutHarness shortcut={{ key: 'n', handler }} inputAutofocus />,
    );
    const input = getByTestId('text') as HTMLInputElement;
    input.focus();
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'n', bubbles: true }),
      );
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test('fires while focus is in an input when evenInEditable=true', () => {
    const handler = mock();
    const { getByTestId } = render(
      <ShortcutHarness
        shortcut={{ key: 'n', handler, evenInEditable: true }}
        inputAutofocus
      />,
    );
    const input = getByTestId('text') as HTMLInputElement;
    input.focus();
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'n', bubbles: true }),
      );
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('space key with meta resolves to Cmd+Space (Quick Entry shape)', () => {
    const handler = mock();
    render(<ShortcutHarness shortcut={{ key: ' ', meta: true, handler }} />);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', metaKey: true, bubbles: true }),
      );
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('listener unmounts cleanly', () => {
    const handler = mock();
    const { unmount } = render(
      <ShortcutHarness shortcut={{ key: 'n', meta: true, handler }} />,
    );
    unmount();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true }),
      );
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test('enabled=false suppresses the binding', () => {
    const handler = mock();
    render(
      <ShortcutHarness
        shortcut={{ key: 'n', meta: true, handler, enabled: false }}
      />,
    );
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true }),
      );
    });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useCustomEvent', () => {
  test('registers and fires on dispatched event', () => {
    const handler = mock();
    render(<EventHarness name="x:test" handler={handler} />);
    act(() => {
      window.dispatchEvent(new CustomEvent('x:test'));
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('unmount removes the listener', () => {
    const handler = mock();
    const { unmount } = render(<EventHarness name="x:test" handler={handler} />);
    unmount();
    act(() => {
      window.dispatchEvent(new CustomEvent('x:test'));
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test('QUICK_ENTRY_OPEN_EVENT exports the agreed name', () => {
    expect(QUICK_ENTRY_OPEN_EVENT).toBe('todo-p2p:quick-entry-open');
  });
});
