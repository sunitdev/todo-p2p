import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Todo } from '@todo-p2p/core';
import { TodoDetail } from '../../src/components/TodoDetail';

afterEach(cleanup);

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'a',
    title: 'Draft',
    done: false,
    createdAt: 0,
    ...overrides,
  };
}

function setup(overrides: Partial<Parameters<typeof TodoDetail>[0]> = {}) {
  const onPatch = mock();
  const onDelete = mock();
  const onClose = mock();
  const utils = render(
    <>
      <button>outside</button>
      <TodoDetail
        todo={todo()}
        onPatch={onPatch}
        onDelete={onDelete}
        onClose={onClose}
        {...overrides}
      />
    </>,
  );
  return { ...utils, onPatch, onDelete, onClose };
}

describe('TodoDetail', () => {
  test('renders title + notes + meta controls + Done editing button', () => {
    setup({ todo: todo({ notes: 'hello' }) });
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'When' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flag' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Done editing/ })).toBeInTheDocument();
  });

  test('title is editable and Done editing flushes a patch', async () => {
    const user = userEvent.setup();
    const { onPatch, onClose } = setup();
    const title = screen.getByLabelText('Title') as HTMLInputElement;
    await user.tripleClick(title);
    await user.keyboard('Renamed');
    await user.click(screen.getByRole('button', { name: /Done editing/ }));
    expect(onPatch).toHaveBeenCalledWith({ title: 'Renamed' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Notes edit flushed on close', async () => {
    const user = userEvent.setup();
    const { onPatch } = setup();
    await user.click(screen.getByLabelText('Notes'));
    await user.keyboard('Chapter 3');
    await user.click(screen.getByRole('button', { name: /Done editing/ }));
    expect(onPatch).toHaveBeenCalledWith({ notes: 'Chapter 3' });
  });

  test('Esc collapses via onClose (and still flushes)', async () => {
    const user = userEvent.setup();
    const { onClose, onPatch } = setup();
    const title = screen.getByLabelText('Title') as HTMLInputElement;
    await user.tripleClick(title);
    await user.keyboard('NewTitle');
    fireEvent.keyDown(title, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith({ title: 'NewTitle' });
  });

  test('Delete button fires onDelete', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup();
    await user.click(screen.getByRole('button', { name: /Delete/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test('Flag toggle emits flagged patch', async () => {
    const user = userEvent.setup();
    const { onPatch } = setup();
    await user.click(screen.getByRole('button', { name: 'Flag' }));
    expect(onPatch).toHaveBeenCalledWith({ flagged: true });
  });

  test('clicking outside the card commits and closes', () => {
    const { onClose } = setup();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('When button invokes its optional callback', async () => {
    const user = userEvent.setup();
    const onOpenWhen = mock();
    setup({ onOpenWhen });
    await user.click(screen.getByRole('button', { name: 'When' }));
    expect(onOpenWhen).toHaveBeenCalledTimes(1);
  });

  test('unchanged title + notes does not emit a patch', async () => {
    const user = userEvent.setup();
    const { onPatch } = setup({ todo: todo({ notes: 'same' }) });
    await user.click(screen.getByRole('button', { name: /Done editing/ }));
    expect(onPatch).not.toHaveBeenCalled();
  });
});
