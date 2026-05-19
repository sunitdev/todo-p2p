import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Area, Project, Tag } from '@todo-p2p/core';
import { Sidebar } from '../../src/components/Sidebar';

afterEach(cleanup);

const baseProps = {
  selection: { kind: 'section' as const, id: 'today' as const },
  onSelect: () => {},
  areas: [] as Area[],
  projects: [] as Project[],
  onCreateArea: () => {},
  onCreateProject: (_: string | null) => {},
  onEditArea: () => {},
  onEditProject: () => {},
  onDeleteArea: () => {},
  onDeleteProject: () => {},
};

describe('Sidebar', () => {
  test('renders primary and secondary section rows', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.getByRole('button', { name: /Inbox/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Today/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upcoming/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anytime/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Someday/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Logbook/ })).toBeInTheDocument();
  });

  test('active row has aria-current=page', () => {
    render(<Sidebar {...baseProps} selection={{ kind: 'section', id: 'inbox' }} />);
    const inbox = screen.getByRole('button', { name: /Inbox/ });
    expect(inbox.getAttribute('aria-current')).toBe('page');
    const today = screen.getByRole('button', { name: /Today/ });
    expect(today.getAttribute('aria-current')).toBeNull();
  });

  test('clicking a section row fires onSelect with section selection', () => {
    const onSelect = mock();
    render(<Sidebar {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Inbox/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'section', id: 'inbox' });
  });

  test('"New List" footer button fires onCreateProject(null)', () => {
    const onCreateProject = mock();
    render(<Sidebar {...baseProps} onCreateProject={onCreateProject} />);
    fireEvent.click(screen.getByRole('button', { name: 'New List' }));
    expect(onCreateProject).toHaveBeenCalledWith(null);
  });

  test('"New area" + button fires onCreateArea', () => {
    const onCreateArea = mock();
    render(<Sidebar {...baseProps} onCreateArea={onCreateArea} />);
    fireEvent.click(screen.getByRole('button', { name: 'New area' }));
    expect(onCreateArea).toHaveBeenCalledTimes(1);
  });

  test('standalone projects section renders only when a project has no areaId', () => {
    const projects: Project[] = [
      {
        id: 'p1',
        title: 'Side quest',
        icon: { kind: 'lucide', name: 'Rocket' },
        color: 'purple',
        areaId: null,
        createdAt: 0,
      },
    ];
    const { rerender } = render(<Sidebar {...baseProps} />);
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    rerender(<Sidebar {...baseProps} projects={projects} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Side quest')).toBeInTheDocument();
  });

  test('renders a ProgressIcon for each standalone project, with progress from projectProgress prop', () => {
    const projects: Project[] = [
      {
        id: 'p1',
        title: 'Alpha',
        icon: { kind: 'lucide', name: 'Rocket' },
        color: 'blue',
        areaId: null,
        createdAt: 0,
      },
      {
        id: 'p2',
        title: 'Beta',
        icon: { kind: 'emoji', value: '🎯' },
        color: 'red',
        areaId: null,
        createdAt: 0,
      },
    ];
    const progressFor = (id: string) => (id === 'p1' ? 0.25 : 0.8);
    render(
      <Sidebar
        {...baseProps}
        projects={projects}
        projectProgress={progressFor}
      />,
    );
    // Each project row exposes the ring via role="img" w/ a label that
    // includes the rounded percentage — assert both rows independently.
    expect(screen.getByRole('img', { name: 'Progress 25%' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Progress 80%' })).toBeInTheDocument();
    // Emoji inner still renders.
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  test('falls back to 0% progress when projectProgress is omitted', () => {
    const projects: Project[] = [
      {
        id: 'p1',
        title: 'Solo',
        icon: { kind: 'lucide', name: 'Folder' },
        color: 'green',
        areaId: null,
        createdAt: 0,
      },
    ];
    render(<Sidebar {...baseProps} projects={projects} />);
    expect(screen.getByRole('img', { name: 'Progress 0%' })).toBeInTheDocument();
  });

  test('projects inside areas also receive their progress', () => {
    const areas: Area[] = [
      { id: 'a1', name: 'Work', color: 'indigo', createdAt: 0 },
    ];
    const projects: Project[] = [
      {
        id: 'p1',
        title: 'Inside',
        icon: { kind: 'lucide', name: 'Folder' },
        color: 'teal',
        areaId: 'a1',
        createdAt: 0,
      },
    ];
    render(
      <Sidebar
        {...baseProps}
        areas={areas}
        projects={projects}
        projectProgress={(id) => (id === 'p1' ? 0.5 : 0)}
      />,
    );
    expect(screen.getByRole('img', { name: 'Progress 50%' })).toBeInTheDocument();
  });

  test('right-click on area row opens ContextMenu with rename/delete items', () => {
    const areas: Area[] = [
      { id: 'a1', name: 'Work', color: 'indigo', createdAt: 0 },
    ];
    render(<Sidebar {...baseProps} areas={areas} />);
    const areaLabel = screen.getByText('Work');
    // bubble from inner label up to the AreaRow container
    fireEvent.contextMenu(areaLabel);
    expect(screen.getByRole('menuitem', { name: /New project in area/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Edit area/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete area/ })).toBeInTheDocument();
  });
});

function tagFx(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 't1',
    name: 'Focus',
    color: 'purple',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('Sidebar — Tags section', () => {
  test('TAGS heading + rows render when tags non-empty', () => {
    render(
      <Sidebar
        {...baseProps}
        tags={[tagFx({ id: 't1', name: 'Focus' }), tagFx({ id: 't2', name: 'Errand', color: 'green' })]}
      />,
    );
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Focus/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Errand/ })).toBeInTheDocument();
  });

  test('clicking a tag fires onSelect({ kind:"tag", id })', () => {
    const onSelect = mock();
    render(
      <Sidebar
        {...baseProps}
        onSelect={onSelect}
        tags={[tagFx({ id: 't1', name: 'Focus' })]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Focus/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'tag', id: 't1' });
  });

  test('selected tag row carries aria-current=page', () => {
    render(
      <Sidebar
        {...baseProps}
        selection={{ kind: 'tag', id: 't1' }}
        tags={[tagFx({ id: 't1', name: 'Focus' })]}
      />,
    );
    expect(screen.getByRole('button', { name: /Focus/ }).getAttribute('aria-current')).toBe('page');
  });

  test('"New tag" button fires onCreateTag', () => {
    const onCreateTag = mock();
    render(<Sidebar {...baseProps} onCreateTag={onCreateTag} tags={[tagFx()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'New tag' }));
    expect(onCreateTag).toHaveBeenCalledTimes(1);
  });

  test('right-click on tag row opens Edit/Delete menu', () => {
    const onEditTag = mock();
    const onDeleteTag = mock();
    render(
      <Sidebar
        {...baseProps}
        onEditTag={onEditTag}
        onDeleteTag={onDeleteTag}
        tags={[tagFx({ id: 't1', name: 'Focus' })]}
      />,
    );
    fireEvent.contextMenu(screen.getByRole('button', { name: /Focus/ }));
    expect(screen.getByRole('menuitem', { name: /Edit tag/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete tag/ })).toBeInTheDocument();
  });

  test('renders tag counts when tagCount returns positive values', () => {
    render(
      <Sidebar
        {...baseProps}
        tags={[tagFx({ id: 't1', name: 'Focus' })]}
        tagCount={(id) => (id === 't1' ? 4 : 0)}
      />,
    );
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
