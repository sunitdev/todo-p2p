import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

afterEach(cleanup);

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  test('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  test('catches a throw and shows the recoverable fallback', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  test('invokes onError with the caught error', () => {
    const onError = mock((_error: Error) => {});
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0].message).toBe('kaboom');
  });

  test('custom fallback receives error + reset', () => {
    render(
      <ErrorBoundary fallback={(e) => <span>caught: {e.message}</span>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('caught: kaboom')).toBeInTheDocument();
  });
});
