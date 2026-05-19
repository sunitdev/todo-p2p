import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tag } from '@todo-p2p/core';
import { TagPicker } from '../../src/components/TagPicker';

afterEach(cleanup);

function tag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 't1',
    name: 'Focus',
    color: 'purple',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function renderPicker(
  overrides: Partial<Parameters<typeof TagPicker>[0]> = {},
) {
  const onChange = mock();
  const onClose = mock();
  const onCreateTag = mock(async () => 'new-id');
  const tags = overrides.tags ?? [
    tag({ id: 't1', name: 'Focus', color: 'purple' }),
    tag({ id: 't2', name: 'Errand', color: 'green' }),
  ];
  const utils = render(
    <TagPicker
      tags={tags}
      value={overrides.value ?? []}
      onChange={overrides.onChange ?? onChange}
      onCreateTag={overrides.onCreateTag ?? onCreateTag}
      onClose={overrides.onClose ?? onClose}
      anchor={overrides.anchor ?? { x: 50, y: 50 }}
    />,
  );
  return { ...utils, onChange, onClose, onCreateTag };
}

describe('TagPicker', () => {
  test('lists all tags as options', () => {
    renderPicker();
    const picker = screen.getByTestId('tag-picker');
    expect(within(picker).getByRole('option', { name: /Focus/ })).toBeInTheDocument();
    expect(within(picker).getByRole('option', { name: /Errand/ })).toBeInTheDocument();
  });

  test('search filters by name (case-insensitive substring)', () => {
    renderPicker();
    fireEvent.change(screen.getByLabelText('Search tags'), {
      target: { value: 'foc' },
    });
    expect(screen.getByRole('option', { name: /Focus/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Errand/ })).toBeNull();
  });

  test('selected tags render a check icon', () => {
    renderPicker({ value: ['t2'] });
    const focus = screen.getByRole('option', { name: /Focus/ });
    const errand = screen.getByRole('option', { name: /Errand/ });
    expect(focus.getAttribute('aria-selected')).toBe('false');
    expect(errand.getAttribute('aria-selected')).toBe('true');
    expect(within(errand).getByLabelText('Selected')).toBeInTheDocument();
  });

  test('clicking an unselected tag adds it to the value', () => {
    const onChange = mock();
    renderPicker({ onChange, value: [] });
    fireEvent.click(screen.getByRole('option', { name: /Focus/ }));
    expect(onChange).toHaveBeenCalledWith(['t1']);
  });

  test('clicking a selected tag removes it', () => {
    const onChange = mock();
    renderPicker({ onChange, value: ['t1', 't2'] });
    fireEvent.click(screen.getByRole('option', { name: /Focus/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(['t2']);
  });

  test('"+ New Tag" inline creates then toggles the new id on', async () => {
    const user = userEvent.setup();
    const onChange = mock();
    const onCreateTag = mock(async () => 'created-id');
    renderPicker({ onChange, onCreateTag, value: ['t1'] });

    await user.click(screen.getByRole('button', { name: /New Tag/ }));
    await user.type(screen.getByLabelText('New tag name'), 'Reading');
    await user.click(screen.getByRole('radio', { name: 'blue' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreateTag).toHaveBeenCalledWith({ name: 'Reading', color: 'blue' });
    expect(onChange).toHaveBeenCalledWith(['t1', 'created-id']);
  });

  test('empty state when no tags exist', () => {
    renderPicker({ tags: [] });
    expect(screen.getByText('No tags yet')).toBeInTheDocument();
  });

  test('Escape closes the picker', () => {
    const onClose = mock();
    renderPicker({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
