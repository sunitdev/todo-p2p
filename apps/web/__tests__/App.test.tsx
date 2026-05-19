import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { App, ErrorScreen, Splash, hasWebTransport } from '../src/App';

afterEach(cleanup);

describe('App splash/error views', () => {
  test('Splash renders loading label', () => {
    render(<Splash />);
    expect(screen.getByText(/Opening secure store/)).toBeInTheDocument();
  });

  test('ErrorScreen renders provided message and headline', () => {
    render(<ErrorScreen message="storage corrupt" />);
    expect(screen.getByText('Cannot start')).toBeInTheDocument();
    expect(screen.getByText('storage corrupt')).toBeInTheDocument();
  });
});

describe('hasWebTransport feature-detect', () => {
  test('returns false when WebTransport is undefined', () => {
    expect(hasWebTransport({})).toBe(false);
  });

  test('returns false when WebTransport is not a constructor', () => {
    expect(hasWebTransport({ WebTransport: 'nope' })).toBe(false);
  });

  test('returns true when WebTransport is a function', () => {
    expect(hasWebTransport({ WebTransport: function WT() {} })).toBe(true);
  });
});

describe('App routing on unsupported browser', () => {
  let originalWT: unknown;
  beforeEach(() => {
    originalWT = (globalThis as { WebTransport?: unknown }).WebTransport;
    delete (globalThis as { WebTransport?: unknown }).WebTransport;
  });
  afterEach(() => {
    if (originalWT === undefined) {
      delete (globalThis as { WebTransport?: unknown }).WebTransport;
    } else {
      (globalThis as { WebTransport?: unknown }).WebTransport = originalWT;
    }
  });

  test('renders Unsupported when WebTransport missing, skips engine init', async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText('Browser not supported')).toBeInTheDocument(),
    );
    // Splash must not remain mounted.
    expect(screen.queryByText(/Opening secure store/)).toBeNull();
  });
});
