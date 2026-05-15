import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../../src/components/Modal';

afterEach(cleanup);

describe('Modal', () => {
  test('renders dialog with accessible name and content', () => {
    render(
      <Modal title="My modal" onClose={() => {}}>
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'My modal' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  test('Escape key calls onClose', () => {
    const onClose = mock();
    render(<Modal title="x" onClose={onClose}>body</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking the backdrop closes; clicking inside does not', () => {
    const onClose = mock();
    render(
      <Modal title="x" onClose={onClose}>
        <span data-testid="inner">x</span>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    // backdrop click — target === currentTarget
    fireEvent.mouseDown(dialog, { target: dialog });
    expect(onClose).toHaveBeenCalledTimes(1);

    // inner click does not close
    fireEvent.mouseDown(screen.getByTestId('inner'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Close button has accessible name and invokes onClose', () => {
    const onClose = mock();
    render(<Modal title="x" onClose={onClose}>body</Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('footer renders when provided', () => {
    render(
      <Modal title="x" onClose={() => {}} footer={<button>Submit</button>}>
        body
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  test('removes keydown listener on unmount', () => {
    const onClose = mock();
    const { unmount } = render(<Modal title="x" onClose={onClose}>body</Modal>);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
