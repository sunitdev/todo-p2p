import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TagForm } from '../../src/components/TagForm';

afterEach(cleanup);

describe('TagForm', () => {
  test('submit disabled until name has non-whitespace content', () => {
    render(
      <TagForm title="New tag" submitLabel="Create" onClose={() => {}} onSubmit={() => {}} />,
    );
    const submit = screen.getByRole('button', { name: 'Create' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Errand, Focus…'), {
      target: { value: '   ' },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Errand, Focus…'), {
      target: { value: 'Focus' },
    });
    expect(submit).not.toBeDisabled();
  });

  test('submit emits trimmed name + selected color', () => {
    const onSubmit = mock();
    render(
      <TagForm title="New tag" submitLabel="Create" onClose={() => {}} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Errand, Focus…'), {
      target: { value: '  Focus  ' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Purple' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Focus', color: 'purple' });
  });

  test('prefills from initial when editing', () => {
    render(
      <TagForm
        title="Edit tag"
        submitLabel="Save"
        initial={{ name: 'Errand', color: 'green' }}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText('Errand, Focus…') as HTMLInputElement;
    expect(input.value).toBe('Errand');
    expect(screen.getByRole('radio', { name: 'Green' }).getAttribute('aria-checked')).toBe('true');
  });

  test('Cancel fires onClose', () => {
    const onClose = mock();
    render(
      <TagForm title="x" submitLabel="Save" onClose={onClose} onSubmit={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
