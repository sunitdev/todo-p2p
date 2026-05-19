import { afterEach, beforeEach, describe, expect, test, mock } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Pairing } from '../../src/screens/Pairing';

afterEach(cleanup);

function setNow(t: number) {
  // happy-dom doesn't ship Bun's fake-timer; mock Date.now directly.
  Date.now = () => t;
}

describe('Pairing screen', () => {
  const ORIGINAL_NOW = Date.now;
  let intervalId = 0;
  const intervals = new Map<number, () => void>();
  let origSetInterval: typeof window.setInterval;
  let origClearInterval: typeof window.clearInterval;

  beforeEach(() => {
    intervalId = 0;
    intervals.clear();
    origSetInterval = window.setInterval;
    origClearInterval = window.clearInterval;
    // Replace setInterval so tests drive ticks deterministically.
    (window as unknown as { setInterval: typeof setInterval }).setInterval = ((
      cb: () => void,
    ) => {
      intervalId += 1;
      intervals.set(intervalId, cb);
      return intervalId as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval;
    (window as unknown as { clearInterval: typeof clearInterval }).clearInterval = ((
      id: number,
    ) => {
      intervals.delete(id);
    }) as typeof clearInterval;
  });

  afterEach(() => {
    Date.now = ORIGINAL_NOW;
    (window as unknown as { setInterval: typeof setInterval }).setInterval = origSetInterval;
    (window as unknown as { clearInterval: typeof clearInterval }).clearInterval =
      origClearInterval;
  });

  function tick() {
    act(() => {
      for (const cb of intervals.values()) cb();
    });
  }

  const baseProps = () => {
    setNow(1_000_000);
    return {
      payload: 'pairing-payload-blob',
      expiresAt: 1_000_000 + 60_000,
      fingerprint: 'a3·f9·7c',
      onConfirm: mock(),
      onSwitchToScan: mock(),
      onRegenerate: mock(),
    };
  };

  test('renders title, fingerprint, and countdown at full TTL', () => {
    const props = baseProps();
    render(<Pairing {...props} />);
    expect(screen.getByText('Pair device')).toBeInTheDocument();
    expect(screen.getByText('a3·f9·7c')).toBeInTheDocument();
    expect(screen.getByText(/Expires in 01:00/)).toBeInTheDocument();
  });

  test('countdown ticks every second', () => {
    const props = baseProps();
    render(<Pairing {...props} />);
    expect(screen.getByText(/01:00/)).toBeInTheDocument();
    setNow(1_000_000 + 1_000);
    tick();
    expect(screen.getByText(/00:59/)).toBeInTheDocument();
    setNow(1_000_000 + 2_000);
    tick();
    expect(screen.getByText(/00:58/)).toBeInTheDocument();
  });

  test('countdown switches to red at <=10s remaining', () => {
    const props = baseProps();
    render(<Pairing {...props} />);
    const initial = screen.getByText(/Expires in/);
    expect(initial.className).toContain('text-label-secondary');

    setNow(1_000_000 + 50_000); // 10s left
    tick();
    const low = screen.getByText(/00:10/);
    expect(low.className).toContain('text-red');
  });

  test('on expiry: shows error, hides Confirm match, exposes Generate new code', () => {
    const props = baseProps();
    render(<Pairing {...props} />);
    setNow(1_000_000 + 60_000);
    tick();
    expect(screen.getByText(/Ticket expired/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm match' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Generate new code' }),
    ).toBeInTheDocument();
  });

  test('Confirm match fires onConfirm while valid', () => {
    const props = baseProps();
    render(<Pairing {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm match' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  test('Scan QR instead fires onSwitchToScan', () => {
    const props = baseProps();
    render(<Pairing {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR instead' }));
    expect(props.onSwitchToScan).toHaveBeenCalledTimes(1);
  });

  test('Generate new code fires onRegenerate after expiry', () => {
    const props = baseProps();
    render(<Pairing {...props} />);
    setNow(1_000_000 + 61_000);
    tick();
    fireEvent.click(screen.getByRole('button', { name: 'Generate new code' }));
    expect(props.onRegenerate).toHaveBeenCalledTimes(1);
  });
});
