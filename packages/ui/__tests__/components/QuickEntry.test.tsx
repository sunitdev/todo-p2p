import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickEntry } from '../../src/components/QuickEntry';
import type { TodoInput } from '../../src/lib/store';

afterEach(cleanup);

function setup(
  overrides: {
    onSave?: (input: TodoInput) => void | Promise<void>;
    onClose?: () => void;
    defaultSelection?: Parameters<typeof QuickEntry>[0]['defaultSelection'];
  } = {},
) {
  const onSave = mock(overrides.onSave ?? (() => {}));
  const onClose = mock(overrides.onClose ?? (() => {}));
  const utils = render(
    <QuickEntry
      onSave={onSave}
      onClose={onClose}
      {...(overrides.defaultSelection
        ? { defaultSelection: overrides.defaultSelection }
        : {})}
    />,
  );
  return { ...utils, onSave, onClose };
}

describe('QuickEntry', () => {
  test('renders as a dialog with accessible name and autofocuses the title input', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Quick Entry' });
    expect(dialog).toBeInTheDocument();
    const title = screen.getByLabelText('To-do title');
    expect(document.activeElement).toBe(title);
  });

  test('placeholder reads "What to do?"', () => {
    setup();
    expect(screen.getByPlaceholderText('What to do?')).toBeInTheDocument();
  });

  test('"+ Add notes" reveals the notes textarea and focuses it', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add notes/ }));
    const notes = await screen.findByLabelText('Notes');
    expect(notes).toBeInTheDocument();
    expect(document.activeElement).toBe(notes);
  });

  test('Escape calls onClose', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog', { name: 'Quick Entry' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Cmd+Enter with a title fires onSave with that title and then closes', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = setup();
    await user.type(screen.getByLabelText('To-do title'), 'Ship Quick Entry');
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Quick Entry' }), {
      key: 'Enter',
      metaKey: true,
    });
    // onSave is awaited internally — wait a microtask for the close to fire.
    await Promise.resolve();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0]?.[0] as TodoInput;
    expect(arg.title).toBe('Ship Quick Entry');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Cmd+Enter with an empty title does NOT save', () => {
    const { onSave, onClose } = setup();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Quick Entry' }), {
      key: 'Enter',
      metaKey: true,
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('Save button is disabled when title is empty, enabled once filled', async () => {
    const user = userEvent.setup();
    setup();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('To-do title'), 'a');
    expect(save).not.toBeDisabled();
  });

  test('Save button click saves and closes', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = setup();
    await user.type(screen.getByLabelText('To-do title'), 'Walk dog');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect((onSave.mock.calls[0]?.[0] as TodoInput).title).toBe('Walk dog');
    expect(onClose).toHaveBeenCalled();
  });

  test('Cancel button calls onClose without saving', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = setup();
    await user.type(screen.getByLabelText('To-do title'), 'discard me');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('defaultSelection={section: today} files the new todo into Today', async () => {
    const user = userEvent.setup();
    const { onSave } = setup({
      defaultSelection: { kind: 'section', id: 'today' },
    });
    await user.type(screen.getByLabelText('To-do title'), 'today thing');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((onSave.mock.calls[0]?.[0] as TodoInput).scheduledWhen).toBe('today');
  });

  test('defaultSelection={section: someday} sets scheduledWhen=someday', async () => {
    const user = userEvent.setup();
    const { onSave } = setup({
      defaultSelection: { kind: 'section', id: 'someday' },
    });
    await user.type(screen.getByLabelText('To-do title'), 'later');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((onSave.mock.calls[0]?.[0] as TodoInput).scheduledWhen).toBe('someday');
  });

  test('defaultSelection inbox leaves scheduledWhen undefined', async () => {
    const user = userEvent.setup();
    const { onSave } = setup({
      defaultSelection: { kind: 'section', id: 'inbox' },
    });
    await user.type(screen.getByLabelText('To-do title'), 'inboxy');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const arg = onSave.mock.calls[0]?.[0] as TodoInput;
    expect(arg.scheduledWhen).toBeUndefined();
    expect(arg.projectId).toBeUndefined();
  });

  test('notes content is included in the saved input when filled', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();
    await user.type(screen.getByLabelText('To-do title'), 't');
    await user.click(screen.getByRole('button', { name: /Add notes/ }));
    const notes = await screen.findByLabelText('Notes');
    await user.type(notes, 'context here');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((onSave.mock.calls[0]?.[0] as TodoInput).notes).toBe('context here');
  });

  test('toolbar pills (When/List/Tags) are rendered', () => {
    setup();
    expect(screen.getByRole('button', { name: 'When' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
  });

  test('clicking the When pill opens the DatePicker popover', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'When' }));
    expect(screen.getByRole('dialog', { name: 'Schedule' })).toBeInTheDocument();
  });

  test('clicking the List pill opens the list picker', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('dialog', { name: 'Pick list' })).toBeInTheDocument();
  });
});
