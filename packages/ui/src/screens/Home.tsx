import { useMemo, useState } from 'react';
import {
  Archive,
  Calendar,
  CalendarDays,
  CheckSquare,
  Circle,
  FileText,
  Flag,
  Inbox,
  Layers,
  Plus,
  Search,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { Area, Project } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { COLOR_BORDER } from '../lib/palette';
import { newId } from '../lib/id';
import { useStore } from '../lib/store';
import { Sidebar, type Selection, type SectionId } from '../components/Sidebar';
import { AreaForm } from '../components/AreaForm';
import { ProjectForm } from '../components/ProjectForm';

type DemoTodo = {
  id: string;
  title: string;
  notes?: string;
  section: SectionId;
  projectKey?: 'meet' | 'p1' | 'p2';
  flagged?: boolean;
};

const DEMO_PROJECTS: Record<NonNullable<DemoTodo['projectKey']>, { title: string; color: 'tint' | 'red' | 'green' }> = {
  meet: { title: 'Meet Things for Mac', color: 'tint' },
  p1: { title: 'Project 1', color: 'tint' },
  p2: { title: 'Project 2', color: 'tint' },
};

const DEMO: DemoTodo[] = [
  { id: 'm1', title: 'Create a new to-do', section: 'today', projectKey: 'meet', notes: 'Tap + or press ⌘N' },
  { id: 'm2', title: 'Add some widgets', section: 'today', projectKey: 'meet', notes: 'Drag from the menu bar' },
  { id: 'm3', title: 'Set a reminder so you won’t forget', section: 'today', projectKey: 'meet', notes: 'Use the calendar button' },
  { id: 'p1a', title: 'Project 1 task', section: 'today', projectKey: 'p1' },
  { id: 'p2a', title: 'Project 2 task', section: 'today', projectKey: 'p2' },
  { id: 'i1', title: 'Buy milk', section: 'inbox' },
  { id: 'i2', title: 'Schedule dentist', section: 'inbox' },
  { id: 'i3', title: 'File expense report', section: 'inbox', flagged: true },
  { id: 'u1', title: 'Mom’s birthday', section: 'upcoming' },
  { id: 'u2', title: 'Submit conference talk', section: 'upcoming' },
  { id: 'u3', title: 'Renew passport', section: 'upcoming', flagged: true },
];

type SectionMeta = { title: string; icon: LucideIcon; tint: string; fill?: boolean };

const SECTION_META: Record<SectionId, SectionMeta> = {
  inbox:    { title: 'Inbox',    icon: Inbox,        tint: 'text-blue' },
  today:    { title: 'Today',    icon: Star,         tint: 'text-yellow', fill: true },
  upcoming: { title: 'Upcoming', icon: CalendarDays, tint: 'text-red' },
  anytime:  { title: 'Anytime',  icon: Layers,       tint: 'text-teal' },
  someday:  { title: 'Someday',  icon: Archive,      tint: 'text-tan' },
  logbook:  { title: 'Logbook',  icon: CheckSquare,  tint: 'text-green' },
};

type AreaModal =
  | { mode: 'create' }
  | { mode: 'edit'; area: Area };

type ProjectModal =
  | { mode: 'create'; areaId: string | null }
  | { mode: 'edit'; project: Project };

export function Home() {
  const store = useStore();
  const [selection, setSelection] = useState<Selection>({ kind: 'section', id: 'today' });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [areaModal, setAreaModal] = useState<AreaModal | null>(null);
  const [projectModal, setProjectModal] = useState<ProjectModal | null>(null);

  const selectedProject = useMemo(
    () =>
      selection.kind === 'project'
        ? store.projects.find((p) => p.id === selection.id) ?? null
        : null,
    [selection, store.projects],
  );

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visible =
    selection.kind === 'section'
      ? DEMO.filter((t) => t.section === selection.id)
      : [];

  const grouped = visible.reduce<Record<string, DemoTodo[]>>((acc, t) => {
    const key = t.projectKey ?? '_';
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

  const handleDeleteArea = (a: Area) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete area "${a.name}"? Projects inside become standalone.`)) {
      return;
    }
    void store.removeArea(a.id);
  };

  const handleDeleteProject = (p: Project) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete project "${p.title}"?`)) {
      return;
    }
    void store.removeProject(p.id);
    if (selection.kind === 'project' && selection.id === p.id) {
      setSelection({ kind: 'section', id: 'today' });
    }
  };

  return (
    <div className="flex h-full w-full bg-bg-l2 text-label">
      <Sidebar
        selection={selection}
        onSelect={setSelection}
        areas={store.areas}
        projects={store.projects}
        onCreateArea={() => setAreaModal({ mode: 'create' })}
        onCreateProject={(areaId) => setProjectModal({ mode: 'create', areaId })}
        onEditArea={(area) => setAreaModal({ mode: 'edit', area })}
        onEditProject={(project) => setProjectModal({ mode: 'edit', project })}
        onDeleteArea={handleDeleteArea}
        onDeleteProject={handleDeleteProject}
      />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="px-8 pt-8 pb-3">
          {selection.kind === 'project' && selectedProject ? (
            <ProjectHeader project={selectedProject} />
          ) : (
            <SectionHeader meta={SECTION_META[(selection as { kind: 'section'; id: SectionId }).id]} />
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2">
          {selection.kind === 'project' ? (
            <ProjectEmpty />
          ) : visible.length === 0 ? (
            <Empty />
          ) : (
            <div className="max-w-3xl space-y-7">
              {Object.entries(grouped).map(([groupKey, items]) => {
                const proj = groupKey !== '_' ? DEMO_PROJECTS[groupKey as keyof typeof DEMO_PROJECTS] : null;
                return (
                  <section key={groupKey}>
                    {proj && <ProjectGroupHeading title={proj.title} color={proj.color} />}
                    <ul className={cn('flex flex-col', proj && 'mt-1')}>
                      {items.map((t) => (
                        <TodoRow
                          key={t.id}
                          todo={t}
                          done={checked.has(t.id)}
                          onToggle={() => toggle(t.id)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <MainFooter />
      </main>

      {areaModal?.mode === 'create' && (
        <AreaForm
          title="New area"
          submitLabel="Create"
          onClose={() => setAreaModal(null)}
          onSubmit={async (res) => {
            await store.addArea({ id: newId(), ...res });
            setAreaModal(null);
          }}
        />
      )}
      {areaModal?.mode === 'edit' && (
        <AreaForm
          title="Edit area"
          submitLabel="Save"
          initial={areaModal.area}
          onClose={() => setAreaModal(null)}
          onSubmit={async (res) => {
            await store.updateArea(areaModal.area.id, res);
            setAreaModal(null);
          }}
        />
      )}

      {projectModal?.mode === 'create' && (
        <ProjectForm
          title="New project"
          submitLabel="Create"
          areas={store.areas}
          defaultAreaId={projectModal.areaId}
          onClose={() => setProjectModal(null)}
          onSubmit={async (res) => {
            await store.addProject({ id: newId(), ...res });
            setProjectModal(null);
          }}
        />
      )}
      {projectModal?.mode === 'edit' && (
        <ProjectForm
          title="Edit project"
          submitLabel="Save"
          areas={store.areas}
          initial={projectModal.project}
          onClose={() => setProjectModal(null)}
          onSubmit={async (res) => {
            await store.updateProject(projectModal.project.id, res);
            setProjectModal(null);
          }}
        />
      )}
    </div>
  );
}

function SectionHeader({ meta }: { meta: SectionMeta }) {
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2.5">
      <Icon
        className={cn('size-6', meta.tint)}
        fill={meta.fill ? 'currentColor' : 'none'}
      />
      <h1 className="text-title font-bold tracking-tight text-label">{meta.title}</h1>
    </div>
  );
}

function ProjectHeader({ project }: { project: Project }) {
  if (project.icon.kind === 'emoji') {
    return (
      <div className="flex items-center gap-2.5">
        <span className="text-[22px] leading-none">{project.icon.value}</span>
        <h1 className="text-title font-bold tracking-tight text-label">{project.title}</h1>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'inline-block size-4 shrink-0 rounded-full border-2',
          COLOR_BORDER[project.color],
        )}
      />
      <h1 className="text-title font-bold tracking-tight text-label">{project.title}</h1>
    </div>
  );
}

function ProjectGroupHeading({ title, color }: { title: string; color: 'tint' | 'red' | 'green' }) {
  const borderClass =
    color === 'red' ? 'border-red' : color === 'green' ? 'border-green' : 'border-tint';
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className={cn('inline-block size-[14px] shrink-0 rounded-full border-2', borderClass)} />
      <span className="text-headline font-bold text-label">{title}</span>
    </div>
  );
}

function TodoRow({
  todo,
  done,
  onToggle,
}: {
  todo: DemoTodo;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="group flex items-center gap-2 rounded-1 px-1 py-1 hover:bg-bg-l3">
      <button
        onClick={onToggle}
        aria-checked={done}
        role="checkbox"
        className={cn(
          'inline-flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-colors',
          done
            ? 'border-tint bg-tint text-white'
            : 'border-label-tertiary group-hover:border-label-secondary',
        )}
      >
        {done && (
          <svg viewBox="0 0 16 16" className="size-2.5" aria-hidden>
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.5 8.5l3 3 6-7"
            />
          </svg>
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={cn(
            'text-body truncate',
            done ? 'text-label-tertiary line-through' : 'text-label',
          )}
        >
          {todo.title}
        </span>
        {todo.flagged && <Flag className="size-3 shrink-0 text-orange" />}
      </div>
      {todo.notes && (
        <FileText className="size-3 shrink-0 text-label-tertiary" aria-hidden />
      )}
    </li>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center pt-24 text-center">
      <Circle className="size-8 text-label-tertiary" />
      <p className="mt-3 text-callout text-label-secondary">Nothing here yet</p>
      <p className="mt-1 text-footnote text-label-tertiary">Tap + to add a to-do.</p>
    </div>
  );
}

function ProjectEmpty() {
  return (
    <div className="flex flex-col items-center justify-center pt-24 text-center">
      <Circle className="size-8 text-label-tertiary" />
      <p className="mt-3 text-callout text-label-secondary">No to-dos in this project yet</p>
      <p className="mt-1 text-footnote text-label-tertiary">Todo↔project wiring lands next.</p>
    </div>
  );
}

function ToolbarBtn({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-bg-l3 hover:text-label"
    >
      <Icon className="size-4" />
    </button>
  );
}

function MainFooter() {
  return (
    <footer className="border-t border-separator bg-bg-l1 px-8 py-2" aria-label="Toolbar">
      <div className="flex items-center justify-center gap-16">
        <button
          aria-label="New To-Do"
          className="inline-flex size-8 items-center justify-center rounded-full bg-tint text-white hover:opacity-90"
        >
          <Plus className="size-4" />
        </button>
        <ToolbarBtn icon={Calendar} label="Schedule" />
        <ToolbarBtn icon={Search} label="Search" />
      </div>
    </footer>
  );
}
