import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { Unsupported } from '../../src/screens/Unsupported';

afterEach(cleanup);

describe('Unsupported screen', () => {
  test('renders title and body copy', () => {
    render(<Unsupported />);
    expect(screen.getByText('Browser not supported')).toBeInTheDocument();
    expect(screen.getByText(/lacks WebTransport/)).toBeInTheDocument();
  });

  test('Get desktop app link defaults to placeholder href with target=_blank', () => {
    render(<Unsupported />);
    const link = screen.getByRole('link', { name: 'Get desktop app' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#download');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  test('Get desktop app link uses provided downloadUrl when given', () => {
    render(<Unsupported downloadUrl="https://example.invalid/dl" />);
    const link = screen.getByRole('link', { name: 'Get desktop app' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.invalid/dl');
  });
});
