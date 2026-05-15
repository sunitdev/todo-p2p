import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Area } from '@todo-p2p/core';
import { ProjectForm } from '../../src/components/ProjectForm';

afterEach(cleanup);

const areas: Area[] = [
  { id: 'a1', name: 'Work', color: 'indigo', createdAt: 0 },
  { id: 'a2', name: 'Home', color: 'teal', createdAt: 0 },
];

describe('ProjectForm', () => {
  test('submit disabled until title is non-blank', () => {
    render(
      <ProjectForm
        title="New project"
        submitLabel="Create"
        areas={areas}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    const submit = screen.getByRole('button', { name: 'Create' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Launch v1, Renovate kitchen…'), {
      target: { value: 'Launch v2' },
    });
    expect(submit).not.toBeDisabled();
  });

  test('submit emits trimmed title + empty-string description (no undefined)', () => {
    const onSubmit = mock();
    render(
      <ProjectForm
        title="New project"
        submitLabel="Create"
        areas={areas}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Launch v1, Renovate kitchen…'), {
      target: { value: '  Launch  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]![0];
    expect(arg.title).toBe('Launch');
    // Regression guard: description must be '' not undefined (Automerge no-undefined rule).
    expect(arg.description).toBe('');
    expect(arg.icon).toEqual({ kind: 'lucide', name: 'Folder' });
    expect(arg.color).toBe('tint');
    expect(arg.areaId).toBeNull();
  });

  test('defaultAreaId is preselected', () => {
    const onSubmit = mock();
    render(
      <ProjectForm
        title="New project"
        submitLabel="Create"
        areas={areas}
        defaultAreaId="a1"
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Launch v1, Renovate kitchen…'), {
      target: { value: 'P' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit.mock.calls[0]![0].areaId).toBe('a1');
  });

  test('selecting "No area" submits areaId = null', () => {
    const onSubmit = mock();
    render(
      <ProjectForm
        title="New project"
        submitLabel="Create"
        areas={areas}
        defaultAreaId="a1"
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Launch v1, Renovate kitchen…'), {
      target: { value: 'P' },
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit.mock.calls[0]![0].areaId).toBeNull();
  });

  test('prefills from initial when editing', () => {
    render(
      <ProjectForm
        title="Edit project"
        submitLabel="Save"
        areas={areas}
        initial={{
          title: 'Renovate',
          description: 'phase 1',
          icon: { kind: 'lucide', name: 'Hammer' },
          color: 'teal',
          areaId: 'a2',
        }}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(
      (screen.getByPlaceholderText('Launch v1, Renovate kitchen…') as HTMLInputElement).value,
    ).toBe('Renovate');
    expect((screen.getByPlaceholderText('Optional') as HTMLTextAreaElement).value).toBe('phase 1');
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('a2');
  });
});
