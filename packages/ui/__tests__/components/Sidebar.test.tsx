import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Area, Project } from '@todo-p2p/core';
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
