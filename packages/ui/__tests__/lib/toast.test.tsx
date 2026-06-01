import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../../src/lib/toast';

afterEach(cleanup);

/** Renders a button that fires a notify on click, plus the provider. */
function Harness({
  level,
  message,
  infoTtlMs = 4000,
}: {
  level: 'error' | 'info';
  message: string;
  infoTtlMs?: number;
}) {
  return (
    <ToastProvider infoTtlMs={infoTtlMs}>
      <Trigger level={level} message={message} />
    </ToastProvider>
  );
}

function Trigger({ level, message }: { level: 'error' | 'info'; message: string }) {
  const { notify } = useToast();
  return (
    <button type="button" onClick={() => notify({ level, message })}>
      go
    </button>
  );
}

describe('ToastProvider / useToast', () => {
  test('notify renders an error toast with role=alert', () => {
    render(<Harness level="error" message="Disk full" />);
    act(() => screen.getByText('go').click());
    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Disk full');
  });

  test('error toasts persist (no auto-dismiss)', async () => {
    render(<Harness level="error" message="Persistent" infoTtlMs={5} />);
    act(() => screen.getByText('go').click());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('alert')).toHaveTextContent('Persistent');
  });

  test('info toasts auto-dismiss after the ttl', async () => {
    render(<Harness level="info" message="Connected" infoTtlMs={5} />);
    act(() => screen.getByText('go').click());
    expect(screen.getByRole('status')).toHaveTextContent('Connected');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  test('dismiss button removes the toast', async () => {
    render(<Harness level="error" message="Bye" />);
    act(() => screen.getByText('go').click());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => screen.getByLabelText('Dismiss').click());
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  test('useToast throws outside a provider', () => {
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/within <ToastProvider>/);
  });
});
