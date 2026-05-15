import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AreaForm } from '../../src/components/AreaForm';

afterEach(cleanup);

describe('AreaForm', () => {
  test('submit disabled until name has non-whitespace content', () => {
    render(
      <AreaForm title="New area" submitLabel="Create" onClose={() => {}} onSubmit={() => {}} />,
    );
    const submit = screen.getByRole('button', { name: 'Create' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Personal, Work…'), {
      target: { value: '   ' },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Personal, Work…'), {
      target: { value: 'Work' },
    });
    expect(submit).not.toBeDisabled();
  });

  test('submit emits trimmed name + selected color', () => {
    const onSubmit = mock();
    render(
      <AreaForm title="New area" submitLabel="Create" onClose={() => {}} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Personal, Work…'), {
      target: { value: '  Work  ' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Indigo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Work', color: 'indigo' });
  });

  test('prefills from initial when editing', () => {
    render(
      <AreaForm
        title="Edit area"
        submitLabel="Save"
        initial={{ name: 'Home', color: 'teal' }}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText('Personal, Work…') as HTMLInputElement;
    expect(input.value).toBe('Home');
    expect(screen.getByRole('radio', { name: 'Teal' }).getAttribute('aria-checked')).toBe('true');
  });

  test('Cancel fires onClose', () => {
    const onClose = mock();
    render(
      <AreaForm title="x" submitLabel="Save" onClose={onClose} onSubmit={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
