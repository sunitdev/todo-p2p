import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RowContextMenu } from '../../src/components/RowContextMenu';

afterEach(cleanup);

const ALL_LABELS = [
  /Complete/,
  /Flag$/,
  /When…/,
  /Schedule…/,
  /Move to…/,
  /Tags…/,
  /Repeat…/,
  /Delete/,
];

describe('RowContextMenu', () => {
  test('renders the canonical Things3 action set', () => {
    render(
      <RowContextMenu
        x={10}
        y={10}
        onAction={() => {}}
        onClose={() => {}}
      />,
    );
    for (const re of ALL_LABELS) {
      expect(screen.getByRole('menuitem', { name: re })).toBeInTheDocument();
    }
  });

  test('clicking Delete emits "delete" and closes', () => {
    const onAction = mock();
    const onClose = mock();
    render(
      <RowContextMenu x={0} y={0} onAction={onAction} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(onAction).toHaveBeenCalledWith('delete');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking Flag emits "flag"', () => {
    const onAction = mock();
    render(
      <RowContextMenu x={0} y={0} onAction={onAction} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /Flag/ }));
    expect(onAction).toHaveBeenCalledWith('flag');
  });

  test('selectionCount > 1 pluralizes destructive labels', () => {
    render(
      <RowContextMenu
        x={0}
        y={0}
        selectionCount={3}
        onAction={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('menuitem', { name: /Delete 3 to-dos/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Complete 3 to-dos/ })).toBeInTheDocument();
  });

  test('alreadyDone flips Complete label to "Mark as not done"', () => {
    render(
      <RowContextMenu
        x={0}
        y={0}
        alreadyDone
        onAction={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('menuitem', { name: /Mark as not done/ })).toBeInTheDocument();
  });

  test('alreadyFlagged flips Flag label to "Unflag"', () => {
    render(
      <RowContextMenu
        x={0}
        y={0}
        alreadyFlagged
        onAction={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('menuitem', { name: /Unflag/ })).toBeInTheDocument();
  });

  test('placeholder Wave-2 actions still emit (so parent can route)', () => {
    const onAction = mock();
    render(
      <RowContextMenu x={0} y={0} onAction={onAction} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /When…/ }));
    expect(onAction).toHaveBeenCalledWith('when');
  });
});
