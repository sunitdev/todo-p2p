import { useState } from 'react';
import {
  Inbox,
  Star,
  CalendarDays,
  Plus,
  Search,
  MoreHorizontal,
  Circle,
  Flag,
  Tag,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/cn';

type SectionId = 'inbox' | 'today' | 'upcoming';

type Section = {
  id: SectionId;
  name: string;
  icon: LucideIcon;
  iconClass: string;
  count: number;
};

type Todo = {
  id: string;
  title: string;
  notes?: string;
  section: SectionId;
  group?: 'morning' | 'evening' | 'this-evening';
  tags?: string[];
  due?: string;
  flagged?: boolean;
};

const SECTIONS: Section[] = [
  { id: 'inbox',    name: 'Inbox',    icon: Inbox,        iconClass: 'text-tint',   count: 3 },
  { id: 'today',    name: 'Today',    icon: Star,         iconClass: 'text-yellow', count: 5 },
  { id: 'upcoming', name: 'Upcoming', icon: CalendarDays, iconClass: 'text-red',    count: 8 },
];

const TODOS: Todo[] = [
  { id: '1', title: 'Pick up dry cleaning',          section: 'today', group: 'morning', tags: ['Errands'] },
  { id: '2', title: 'Reply to design review',         section: 'today', group: 'morning', tags: ['Work'], flagged: true },
  { id: '3', title: 'Draft Q2 roadmap',              section: 'today', group: 'morning', notes: 'Focus on sync reliability + UX polish', tags: ['Work'] },
  { id: '4', title: '30-minute walk',                 section: 'today', group: 'evening', tags: ['Health'] },
  { id: '5', title: 'Read “A Pattern Language” ch. 4', section: 'today', group: 'evening', tags: ['Reading'] },

  { id: '6',  title: 'Buy milk',           section: 'inbox' },
  { id: '7',  title: 'Schedule dentist',   section: 'inbox' },
  { id: '8',  title: 'File expense report', section: 'inbox', flagged: true },

  { id: '9',  title: 'Mom’s birthday',      section: 'upcoming', due: 'Sun, May 17', tags: ['Family'] },
  { id: '10', title: 'Submit conference talk', section: 'upcoming', due: 'Mon, May 18', tags: ['Work'] },
  { id: '11', title: 'Renew passport',      section: 'upcoming', due: 'Wed, May 20', tags: ['Personal'], flagged: true },
];

const SECTION_META: Record<SectionId, { title: string; subtitle: string }> = {
  inbox:    { title: 'Inbox',    subtitle: 'Quick capture' },
  today:    { title: 'Today',    subtitle: 'Friday, May 15' },
  upcoming: { title: 'Upcoming', subtitle: 'Next 14 days' },
};

const GROUP_LABEL: Record<NonNullable<Todo['group']>, string> = {
  morning: 'This Morning',
  evening: 'This Evening',
  'this-evening': 'This Evening',
};

const GROUP_ICON: Record<NonNullable<Todo['group']>, LucideIcon> = {
  morning: Sun,
  evening: Star,
  'this-evening': Star,
};

export function Home() {
  const [active, setActive] = useState<SectionId>('today');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visible = TODOS.filter((t) => t.section === active);
  const meta = SECTION_META[active];

  const grouped = visible.reduce<Record<string, Todo[]>>((acc, t) => {
    const key = t.group ?? '_';
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="flex h-full w-full bg-bg-l2 text-label">
      <Sidebar active={active} onSelect={setActive} />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-10 glass-chrome border-b border-separator/60 px-12 pt-10 pb-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-largetitle font-bold tracking-tight">{meta.title}</h1>
              <p className="mt-1 text-callout text-label-secondary">{meta.subtitle}</p>
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-callout text-label-secondary hover:bg-label/5"
              aria-label="More"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-12 pb-32 pt-6">
          {visible.length === 0 ? (
            <Empty />
          ) : (
            <div className="max-w-3xl space-y-8">
              {Object.entries(grouped).map(([groupKey, items]) => (
                <section key={groupKey}>
                  {groupKey !== '_' && (
                    <GroupHeading
                      icon={GROUP_ICON[groupKey as keyof typeof GROUP_ICON]}
                      label={GROUP_LABEL[groupKey as keyof typeof GROUP_LABEL]}
                    />
                  )}
                  <ul className="mt-2 divide-y divide-separator/40">
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
              ))}
            </div>
          )}
        </div>

        <FloatingAdd />
      </main>
    </div>
  );
}

function Sidebar({
  active,
  onSelect,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-separator/60 glass-thin">
      <div className="h-10 shrink-0" />

      <nav className="flex flex-col gap-1 px-3">
        {SECTIONS.map((s) => (
          <SectionRow
            key={s.id}
            section={s}
            active={s.id === active}
            onClick={() => onSelect(s.id)}
          />
        ))}
      </nav>

      <div className="mt-6 px-5 text-caption1 font-semibold uppercase tracking-wider text-label-tertiary">
        Areas
      </div>
      <div className="mt-2 px-3 text-subhead text-label-tertiary">
        <div className="px-3 py-2">No areas yet</div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-separator/60 px-3 py-3">
        <button
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-callout text-label hover:bg-label/5"
          aria-label="New To-Do"
        >
          <Plus className="size-4" />
          <span>New To-Do</span>
        </button>
        <button
          className="inline-flex size-9 items-center justify-center rounded-full text-label-secondary hover:bg-label/5"
          aria-label="Search"
        >
          <Search className="size-4" />
        </button>
      </div>
    </aside>
  );
}

function SectionRow({
  section,
  active,
  onClick,
}: {
  section: Section;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = section.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex h-9 items-center gap-3 rounded-2 px-3 text-callout transition-colors',
        active
          ? 'bg-tint/15 text-label'
          : 'text-label-secondary hover:bg-label/5 hover:text-label',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={cn('size-[18px]', section.iconClass)} />
      <span className="flex-1 text-left">{section.name}</span>
      {section.count > 0 && (
        <span
          className={cn(
            'text-footnote tabular-nums',
            active ? 'text-label-secondary' : 'text-label-tertiary',
          )}
        >
          {section.count}
        </span>
      )}
    </button>
  );
}

function GroupHeading({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 pl-1">
      <Icon className="size-[18px] text-yellow" />
      <span className="text-headline font-semibold text-label">{label}</span>
    </div>
  );
}

function TodoRow({
  todo,
  done,
  onToggle,
}: {
  todo: Todo;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="group flex items-start gap-3 py-2.5 pl-1">
      <button
        onClick={onToggle}
        aria-checked={done}
        role="checkbox"
        className={cn(
          'mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors',
          done
            ? 'border-tint bg-tint text-white'
            : 'border-label-tertiary group-hover:border-label-secondary',
        )}
      >
        {done && (
          <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
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

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-body',
              done ? 'text-label-tertiary line-through' : 'text-label',
            )}
          >
            {todo.title}
          </span>
          {todo.flagged && <Flag className="size-3.5 shrink-0 text-orange" />}
        </div>
        {todo.notes && (
          <p className="text-footnote text-label-secondary line-clamp-1">{todo.notes}</p>
        )}
        {(todo.tags?.length || todo.due) && (
          <div className="mt-0.5 flex items-center gap-2 text-caption1 text-label-secondary">
            {todo.due && (
              <span className="inline-flex items-center gap-1 rounded-1 bg-red/12 px-1.5 py-0.5 text-red">
                <CalendarDays className="size-3" />
                {todo.due}
              </span>
            )}
            {todo.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-1 bg-label/5 px-1.5 py-0.5 text-label-secondary"
              >
                <Tag className="size-3" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center pt-24 text-center">
      <Circle className="size-10 text-label-tertiary" />
      <p className="mt-4 text-headline text-label-secondary">Nothing here yet</p>
      <p className="mt-1 text-subhead text-label-tertiary">Tap + to add a to-do.</p>
    </div>
  );
}

function FloatingAdd() {
  return (
    <button
      aria-label="Quick add"
      className={cn(
        'absolute bottom-8 right-8 inline-flex size-[52px] items-center justify-center rounded-full',
        'bg-tint text-white shadow-key transition-transform hover:scale-[1.04] active:scale-[0.96]',
      )}
    >
      <Plus className="size-6" />
    </button>
  );
}
