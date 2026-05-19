import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MagicPlus } from '../../src/components/MagicPlus';
import { DragProvider } from '../../src/lib/DragContext';

afterEach(cleanup);

describe('MagicPlus', () => {
  test('renders the floating + button with a lucide Plus icon', () => {
    render(<MagicPlus onClick={() => {}} onDrop={() => {}} />);
    const btn = screen.getByTestId('magic-plus');
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('aria-label')).toBe('Magic Plus');
    // The lucide Plus icon renders as an inline SVG inside the button.
    expect(btn.querySelector('svg.lucide-plus')).not.toBeNull();
  });

  test('click fires onClick when not preceded by a drag', () => {
    const onClick = mock();
    render(<MagicPlus onClick={onClick} onDrop={() => {}} />);
    fireEvent.click(screen.getByTestId('magic-plus'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('positioned via Tailwind classes — no inline `style` for placement (CSP)', () => {
    render(<MagicPlus onClick={() => {}} onDrop={() => {}} />);
    const btn = screen.getByTestId('magic-plus');
    expect(btn.className).toContain('absolute');
    expect(btn.className).toContain('right-6');
    expect(btn.className).toContain('bottom-6');
    expect(btn.className).toContain('rounded-full');
    expect(btn.className).toContain('bg-tint');
  });

  test('drag without a registered target snaps back without firing onDrop', () => {
    const onDrop = mock();
    // Wrap in a DragProvider so the drag handlers are active, but register
    // zero targets — `resolveAt` returns null for any coordinate.
    render(
      <DragProvider>
        <MagicPlus onClick={() => {}} onDrop={onDrop} />
      </DragProvider>,
    );
    const btn = screen.getByTestId('magic-plus');
    // motion's drag listens for pointerdown → pointermove → pointerup on the
    // window. happy-dom dispatches these reliably.
    fireEvent.pointerDown(btn, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });
    fireEvent.pointerUp(window, { clientX: 200, clientY: 200 });
    expect(onDrop).not.toHaveBeenCalled();
  });

  test('outside a DragProvider, drag is disabled — button still clicks', () => {
    const onClick = mock();
    const onDrop = mock();
    render(<MagicPlus onClick={onClick} onDrop={onDrop} />);
    fireEvent.click(screen.getByTestId('magic-plus'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDrop).not.toHaveBeenCalled();
  });
});
