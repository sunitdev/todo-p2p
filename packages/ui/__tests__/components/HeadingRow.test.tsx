import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Heading } from '@todo-p2p/core';
import { HeadingRow } from '../../src/components/HeadingRow';

afterEach(cleanup);

function heading(overrides: Partial<Heading> = {}): Heading {
  return {
    id: 'h1',
    projectId: 'p1',
    title: 'Backlog',
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('HeadingRow', () => {
  test('renders the heading title', () => {
    render(<HeadingRow heading={heading()} onRename={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Backlog' })).toBeInTheDocument();
  });

  test('right-click opens menu with Rename + Delete', () => {
    render(<HeadingRow heading={heading()} onRename={() => {}} onDelete={() => {}} />);
    fireEvent.contextMenu(screen.getByTestId('heading-row-h1'));
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  test('Rename → Enter persists new title via onRename', async () => {
    const user = userEvent.setup();
    const onRename = mock();
    render(<HeadingRow heading={heading()} onRename={onRename} onDelete={() => {}} />);
    fireEvent.contextMenu(screen.getByTestId('heading-row-h1'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = await screen.findByLabelText('Heading title');
    await user.clear(input);
    await user.type(input, 'Sprint{enter}');
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith('Sprint');
  });

  test('Rename → Esc cancels without calling onRename', async () => {
    const user = userEvent.setup();
    const onRename = mock();
    render(<HeadingRow heading={heading()} onRename={onRename} onDelete={() => {}} />);
    fireEvent.contextMenu(screen.getByTestId('heading-row-h1'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = await screen.findByLabelText('Heading title');
    await user.clear(input);
    await user.type(input, 'Sprint{escape}');
    expect(onRename).not.toHaveBeenCalled();
    // Back to static h2.
    expect(screen.getByRole('heading', { name: 'Backlog' })).toBeInTheDocument();
  });

  test('Delete fires onDelete and closes the menu', () => {
    const onDelete = mock();
    render(<HeadingRow heading={heading()} onRename={() => {}} onDelete={onDelete} />);
    fireEvent.contextMenu(screen.getByTestId('heading-row-h1'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
