import { useMemo, useState } from 'react';
import {
  Archive,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  FolderPlus,
  Inbox,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { Area, Project } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { COLOR_BG, COLOR_BORDER } from '../lib/palette';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

export type SectionId = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook';

export type Selection =
  | { kind: 'section'; id: SectionId }
  | { kind: 'project'; id: string };

type FixedSection = {
  id: SectionId;
  name: string;
  icon: LucideIcon;
  iconClass: string;
  fill?: boolean;
  count: number;
};

const PRIMARY: FixedSection[] = [
  { id: 'inbox', name: 'Inbox', icon: Inbox, iconClass: 'text-blue', count: 0 },
  { id: 'today', name: 'Today', icon: Star, iconClass: 'text-yellow', fill: true, count: 0 },
  { id: 'upcoming', name: 'Upcoming', icon: CalendarDays, iconClass: 'text-red', count: 0 },
];

const SECONDARY: FixedSection[] = [
  { id: 'anytime', name: 'Anytime', icon: Layers, iconClass: 'text-teal', count: 0 },
  { id: 'someday', name: 'Someday', icon: Archive, iconClass: 'text-tan', count: 0 },
  { id: 'logbook', name: 'Logbook', icon: CheckSquare, iconClass: 'text-green', fill: true, count: 0 },
];

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export function Sidebar({
  selection,
  onSelect,
  areas,
  projects,
  onCreateArea,
  onCreateProject,
  onEditArea,
  onEditProject,
  onDeleteArea,
  onDeleteProject,
}: {
  selection: Selection;
  onSelect(s: Selection): void;
  areas: Area[];
  projects: Project[];
  onCreateArea(): void;
  onCreateProject(areaId: string | null): void;
  onEditArea(a: Area): void;
  onEditProject(p: Project): void;
  onDeleteArea(a: Area): void;
  onDeleteProject(p: Project): void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);

  const standalone = useMemo(
    () => projects.filter((p) => !p.areaId),
    [projects],
  );
  const byArea = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects) {
      if (!p.areaId) continue;
      const arr = map.get(p.areaId) ?? [];
      arr.push(p);
      map.set(p.areaId, arr);
    }
    return map;
  }, [projects]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const showProjectMenu = (x: number, y: number, p: Project) => {
    setMenu({
      x,
      y,
      items: [
        { label: 'Edit project', icon: <Pencil className="size-3.5" />, onSelect: () => onEditProject(p) },
        { label: 'Delete project', icon: <Trash2 className="size-3.5" />, destructive: true, onSelect: () => onDeleteProject(p) },
      ],
    });
  };

  const showAreaMenu = (x: number, y: number, a: Area) => {
    setMenu({
      x,
      y,
      items: [
        { label: 'New project in area', icon: <Plus className="size-3.5" />, onSelect: () => onCreateProject(a.id) },
        { label: 'Edit area', icon: <Pencil className="size-3.5" />, onSelect: () => onEditArea(a) },
        { label: 'Delete area', icon: <Trash2 className="size-3.5" />, destructive: true, onSelect: () => onDeleteArea(a) },
      ],
    });
  };

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-separator bg-bg-l1">
      <div className="h-12 shrink-0" />

      <nav className="flex flex-col gap-0.5 px-2">
        {PRIMARY.map((s) => (
          <FixedRow
            key={s.id}
            section={s}
            active={selection.kind === 'section' && selection.id === s.id}
            onClick={() => onSelect({ kind: 'section', id: s.id })}
          />
        ))}
      </nav>

      <div className="h-3" />

      <nav className="flex flex-col gap-0.5 px-2">
        {SECONDARY.map((s) => (
          <FixedRow
            key={s.id}
            section={s}
            active={selection.kind === 'section' && selection.id === s.id}
            onClick={() => onSelect({ kind: 'section', id: s.id })}
          />
        ))}
      </nav>

      {standalone.length > 0 && (
        <div className="mt-5 px-2">
          <div className="section-header flex items-center justify-between px-2 pb-1">
            <span>Projects</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {standalone.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                active={selection.kind === 'project' && selection.id === p.id}
                onClick={() => onSelect({ kind: 'project', id: p.id })}
                onMenu={(x, y) => showProjectMenu(x, y, p)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 px-2">
        <div className="section-header flex items-center justify-between px-2 pb-1">
          <span>Areas</span>
          <button
            onClick={onCreateArea}
            aria-label="New area"
            className="inline-flex size-5 items-center justify-center rounded-1 text-label-tertiary hover:bg-bg-l3 hover:text-label"
          >
            <Plus className="size-3" />
          </button>
        </div>

        {areas.length === 0 ? (
          <div className="px-2 py-1 text-footnote text-label-tertiary">No areas yet</div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {areas.map((a) => {
              const isCollapsed = collapsed.has(a.id);
              const items = byArea.get(a.id) ?? [];
              return (
                <div key={a.id}>
                  <AreaRow
                    area={a}
                    collapsed={isCollapsed}
                    onToggle={() => toggle(a.id)}
                    onMenu={(x, y) => showAreaMenu(x, y, a)}
                    onAddProject={() => onCreateProject(a.id)}
                  />
                  {!isCollapsed && (
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {items.map((p) => (
                        <ProjectRow
                          key={p.id}
                          project={p}
                          active={selection.kind === 'project' && selection.id === p.id}
                          onClick={() => onSelect({ kind: 'project', id: p.id })}
                          onMenu={(x, y) => showProjectMenu(x, y, p)}
                          indent
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-separator px-3 py-2">
        <button
          onClick={() => onCreateProject(null)}
          className="inline-flex h-7 items-center gap-1.5 rounded-2 px-1.5 pr-2 text-footnote font-medium text-label-secondary hover:bg-bg-l3 hover:text-label"
          aria-label="New List"
        >
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-tint text-white">
            <Plus className="size-2.5" />
          </span>
          <span>New List</span>
        </button>
        <button
          className="inline-flex size-7 items-center justify-center rounded-2 text-label-secondary hover:bg-bg-l3 hover:text-label"
          aria-label="Filter"
        >
          <SlidersHorizontal className="size-3.5" />
        </button>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}

function FixedRow({
  section,
  active,
  onClick,
}: {
  section: FixedSection;
  active: boolean;
  onClick(): void;
}) {
  const Icon = section.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex h-7 items-center gap-2.5 rounded-2 px-2 text-callout transition-colors',
        active
          ? 'row-selected'
          : 'text-label hover:bg-bg-l3',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        className={cn('size-4 shrink-0', active ? 'text-white' : section.iconClass)}
        fill={section.fill ? 'currentColor' : 'none'}
      />
      <span className="flex-1 text-left">{section.name}</span>
      {section.count > 0 && (
        <span
          className={cn(
            'text-footnote tabular-nums',
            active ? 'text-white/80' : 'text-label-tertiary',
          )}
        >
          {section.count}
        </span>
      )}
    </button>
  );
}

function AreaRow({
  area,
  collapsed,
  onToggle,
  onMenu,
  onAddProject,
}: {
  area: Area;
  collapsed: boolean;
  onToggle(): void;
  onMenu(x: number, y: number): void;
  onAddProject(): void;
}) {
  return (
    <div
      className="group flex h-7 items-center gap-1.5 rounded-2 px-2 hover:bg-bg-l3"
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY);
      }}
    >
      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Expand area' : 'Collapse area'}
        className="inline-flex size-4 items-center justify-center rounded-1 text-label-tertiary hover:text-label"
      >
        <ChevronRight
          className={cn('size-3 transition-transform', !collapsed && 'rotate-90')}
        />
      </button>
      <span className={cn('size-2 shrink-0 rounded-full', COLOR_BG[area.color])} />
      <button
        onClick={onToggle}
        className="flex-1 truncate text-left text-footnote font-bold uppercase tracking-wider text-label"
      >
        {area.name}
      </button>
      <button
        onClick={onAddProject}
        aria-label="New project in area"
        className="inline-flex size-5 items-center justify-center rounded-1 text-label-tertiary opacity-0 transition-opacity hover:text-label group-hover:opacity-100"
      >
        <FolderPlus className="size-3" />
      </button>
      <button
        onClick={(e) => onMenu(e.clientX, e.clientY)}
        aria-label="Area actions"
        className="inline-flex size-5 items-center justify-center rounded-1 text-label-tertiary opacity-0 transition-opacity hover:text-label group-hover:opacity-100"
      >
        <MoreHorizontal className="size-3" />
      </button>
    </div>
  );
}

function ProjectRow({
  project,
  active,
  onClick,
  onMenu,
  indent,
}: {
  project: Project;
  active: boolean;
  onClick(): void;
  onMenu(x: number, y: number): void;
  indent?: boolean;
}) {
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY);
      }}
      className={cn(
        'group flex h-7 items-center gap-2 rounded-2 px-2 transition-colors',
        indent && 'pl-5',
        active ? 'row-selected' : 'text-label hover:bg-bg-l3',
      )}
    >
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-2 truncate text-left text-callout"
      >
        <ProjectIcon project={project} active={active} />
        <span className="truncate">{project.title}</span>
      </button>
      <button
        onClick={(e) => onMenu(e.clientX, e.clientY)}
        aria-label="Project actions"
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-1 opacity-0 transition-opacity group-hover:opacity-100',
          active ? 'text-white/80 hover:text-white' : 'text-label-tertiary hover:text-label',
        )}
      >
        <MoreHorizontal className="size-3" />
      </button>
    </div>
  );
}

function ProjectIcon({ project, active }: { project: Project; active?: boolean }) {
  if (project.icon.kind === 'emoji') {
    return (
      <span className="inline-flex size-3.5 items-center justify-center text-[12px] leading-none">
        {project.icon.value}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-block size-3 shrink-0 rounded-full border-2',
        active ? 'border-white' : COLOR_BORDER[project.color],
      )}
    />
  );
}
