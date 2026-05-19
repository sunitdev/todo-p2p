import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { SidebarCount } from '../../src/components/SidebarCount';

afterEach(cleanup);

describe('SidebarCount', () => {
  test('renders nothing for zero (Things3 hides empty counts)', () => {
    const { container } = render(<SidebarCount value={0} />);
    expect(container.querySelector('[data-testid="sidebar-count"]')).toBeNull();
  });

  test('renders nothing for negative values', () => {
    const { container } = render(<SidebarCount value={-1} />);
    expect(container.querySelector('[data-testid="sidebar-count"]')).toBeNull();
  });

  test('renders positive value with tabular-nums', () => {
    render(<SidebarCount value={7} />);
    const wrap = screen.getByTestId('sidebar-count');
    expect(wrap.getAttribute('data-value')).toBe('7');
    expect(wrap.className).toContain('tabular-nums');
    expect(wrap.textContent).toContain('7');
  });

  test('value change re-keys the animated digit (motion uses value as key)', () => {
    const { rerender } = render(<SidebarCount value={1} />);
    expect(screen.getByTestId('sidebar-count').textContent).toContain('1');
    rerender(<SidebarCount value={2} />);
    // After the rerender the new digit is mounted; the old one may briefly
    // co-exist while motion's AnimatePresence runs its exit, so we assert
    // the new digit is present rather than checking the old one is gone.
    expect(screen.getByTestId('sidebar-count').textContent).toContain('2');
    expect(screen.getByTestId('sidebar-count').getAttribute('data-value')).toBe('2');
  });

  test('applies optional className for active-state colour overrides', () => {
    render(<SidebarCount value={3} className="text-white/80" />);
    expect(screen.getByTestId('sidebar-count').className).toContain('text-white/80');
  });
});
