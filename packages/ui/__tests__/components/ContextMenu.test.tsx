import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ContextMenu } from '../../src/components/ContextMenu';

afterEach(cleanup);

describe('ContextMenu', () => {
  test('renders menuitems with their labels', () => {
    render(
      <ContextMenu
        x={10}
        y={10}
        items={[
          { label: 'Edit', onSelect: () => {} },
          { label: 'Delete', destructive: true, onSelect: () => {} },
        ]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  test('clicking an item fires onSelect then onClose', () => {
    const onSelect = mock();
    const onClose = mock();
    render(
      <ContextMenu
        x={0}
        y={0}
        items={[{ label: 'Edit', onSelect }]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Escape closes the menu', () => {
    const onClose = mock();
    render(
      <ContextMenu x={0} y={0} items={[{ label: 'x', onSelect: () => {} }]} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('mousedown outside the menu closes it', () => {
    const onClose = mock();
    render(
      <div>
        <button data-testid="outside">outside</button>
        <ContextMenu x={0} y={0} items={[{ label: 'x', onSelect: () => {} }]} onClose={onClose} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('mousedown inside the menu does not close', () => {
    const onClose = mock();
    render(
      <ContextMenu x={0} y={0} items={[{ label: 'Edit', onSelect: () => {} }]} onClose={onClose} />,
    );
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
