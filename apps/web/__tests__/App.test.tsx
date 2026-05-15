import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorScreen, Splash } from '../src/App';

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
