import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  CalendarDays,
  Inbox,
  Layers,
  Moon,
  Plus,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { PaletteColor, Project } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { COLOR_BG, COLOR_TEXT } from '../lib/palette';
import { tween } from '../lib/motion';
import { useStoreOptional, type TodoInput } from '../lib/store';
import { DatePicker, type DatePickerValue, type DatePickerWhen } from './DatePicker';

/** A `SectionId`-shaped selection — kept narrow so we don't depend on `Home`'s
 *  ad-hoc routing types. Mirrors `packages/ui/src/components/Sidebar.tsx`. */
export type QuickEntrySection =
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'anytime'
  | 'someday'
  | 'logbook';

export type QuickEntryDefault =
  | { kind: 'section'; id: QuickEntrySection }
  | { kind: 'project'; id: string };

export interface QuickEntryProps {
  /** Pre-selects the filing target (current selection in `Home`). When omitted,
   *  defaults to Inbox. */
  defaultSelection?: QuickEntryDefault;
  onSave(input: TodoInput): Promise<void> | void;
  onClose(): void;
}

type ListChoice =
  | { kind: 'section'; id: QuickEntrySection; label: string; icon: LucideIcon; tint: string; fill?: boolean }
  | { kind: 'project'; id: string; label: string; color: PaletteColor };

const SECTION_CHOICES: Array<Extract<ListChoice, { kind: 'section' }>> = [
  { kind: 'section', id: 'inbox',    label: 'Inbox',    icon: Inbox,        tint: 'text-blue' },
  { kind: 'section', id: 'today',    label: 'Today',    icon: Star,         tint: 'text-yellow', fill: true },
  { kind: 'section', id: 'anytime',  label: 'Anytime',  icon: Layers,       tint: 'text-teal' },
  { kind: 'section', id: 'someday',  label: 'Someday',  icon: Archive,      tint: 'text-tan' },
];

interface ResolvedSchedule {
  scheduledWhen: 'today' | 'someday' | null;
  scheduledFor: number | null;
  eveningOnToday: boolean;
}

/**
 * Translate the DatePicker's external `'today-evening'` / `'anytime'` shorthand
 * into the store's narrower `scheduledWhen` enum + `eveningOnToday` flag. Same
 * shape as `Home.tsx#applyPickerValue` — duplicated here so this component
 * stays standalone (no `Home` import dependency).
 */
function resolveSchedule(value: DatePickerValue): ResolvedSchedule {
  const out: ResolvedSchedule = {
    scheduledWhen: null,
    scheduledFor: null,
    eveningOnToday: false,
  };
  if (typeof value.scheduledFor === 'number') {
    out.scheduledFor = value.scheduledFor;
    return out;
  }
  switch (value.scheduledWhen) {
    case 'today':
      out.scheduledWhen = 'today';
      break;
    case 'today-evening':
      out.scheduledWhen = 'today';
      out.eveningOnToday = true;
      break;
    case 'someday':
      out.scheduledWhen = 'someday';
      break;
    case 'anytime':
    case null:
    case undefined:
      break;
  }
  return out;
}

function describeWhen(value: DatePickerValue): { label: string; icon: LucideIcon; tint: string; fill?: boolean } {
  if (typeof value.scheduledFor === 'number') {
    const d = new Date(value.scheduledFor);
    return {
      label: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d),
      icon: CalendarDays,
      tint: 'text-tint',
    };
  }
  const w: DatePickerWhen | null | undefined = value.scheduledWhen;
  if (w === 'today')         return { label: 'Today',        icon: Star,         tint: 'text-yellow', fill: true };
  if (w === 'today-evening') return { label: 'This Evening', icon: Moon,         tint: 'text-tint' };
  if (w === 'someday')       return { label: 'Someday',      icon: Archive,      tint: 'text-tan' };
  if (w === 'anytime')       return { label: 'Anytime',      icon: Layers,       tint: 'text-teal' };
  return { label: 'When',    icon: CalendarDays, tint: 'text-label-secondary' };
}

export function QuickEntry({ defaultSelection, onSave, onClose }: QuickEntryProps) {
  // Store is optional so the component can be unit-tested standalone without
  // a provider. When absent, the List picker only offers the fixed sections.
  const store = useStoreOptional();

  const initialList = useMemo<ListChoice>(() => {
    if (defaultSelection?.kind === 'project' && store) {
      const p = store.projects.find((x) => x.id === defaultSelection.id);
      if (p) return { kind: 'project', id: p.id, label: p.title, color: p.color };
    }
    if (defaultSelection?.kind === 'section') {
      const found = SECTION_CHOICES.find((s) => s.id === defaultSelection.id);
      if (found) return found;
    }
    return SECTION_CHOICES[0]!;
  }, [defaultSelection, store]);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [list, setList] = useState<ListChoice>(initialList);
  const [schedule, setSchedule] = useState<DatePickerValue>({});

  type Picker =
    | { kind: 'when'; anchor: { x: number; y: number } }
    | { kind: 'list'; anchor: { x: number; y: number } };
  const [picker, setPicker] = useState<Picker | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Autofocus on mount and when notes reveals (to focus the new textarea).
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  useLayoutEffect(() => {
    if (showNotes) notesRef.current?.focus();
  }, [showNotes]);

  const save = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const resolved = resolveSchedule(schedule);
    const input: TodoInput = { title: trimmed };
    const trimmedNotes = notes.trim();
    if (trimmedNotes) input.notes = trimmedNotes;
    if (list.kind === 'project') input.projectId = list.id;
    else {
      switch (list.id) {
        case 'today':
          input.scheduledWhen = 'today';
          break;
        case 'someday':
          input.scheduledWhen = 'someday';
          break;
        // inbox/anytime → no scheduledWhen
      }
    }
    if (resolved.scheduledWhen) input.scheduledWhen = resolved.scheduledWhen;
    if (typeof resolved.scheduledFor === 'number') input.scheduledFor = resolved.scheduledFor;
    if (resolved.eveningOnToday) input.eveningOnToday = true;
    if (schedule.recurrence) input.recurrence = schedule.recurrence;
    await onSave(input);
    onClose();
  }, [title, notes, list, schedule, onSave, onClose]);

  // Esc closes; Cmd/Ctrl+Enter saves. Scoped to the panel (not window) so
  // global shortcuts can't double-fire while the panel is open — the
  // `useShortcut` registry that opened it sees keydowns first, but the
  // panel's own keydown listener owns Esc + Enter while focused.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // If a picker popover is open, let it close itself first; the
        // popover's own Esc handler already calls its onClose.
        if (picker) return;
        onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void save();
      }
    },
    [picker, onClose, save],
  );

  // Click-outside support: tracks panel + any open popover. Pickers render
  // outside this panel's DOM subtree, so we have to exclude them too.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      // Don't dismiss while a child popover is open — it handles its own
      // outside-click via stopPropagation through portal-free placement.
      const portal = document.querySelector('[data-testid="date-picker"]');
      if (portal && portal.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const whenDesc = describeWhen(schedule);

  const openPicker = (kind: Picker['kind'], e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPicker({ kind, anchor: { x: rect.left, y: rect.bottom + 4 } });
  };

  return (
    <>
      {/* Scrim — opaque label tint, NO blur (CSP + Things3 flatness). */}
      <div
        className="fixed inset-0 z-40 bg-label/20"
        aria-hidden
        onMouseDown={onClose}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Entry"
        data-testid="quick-entry"
        onKeyDown={onKeyDown}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={tween}
        className="fixed left-1/2 top-1/4 z-50 w-[560px] max-w-[92vw] -translate-x-1/2 rounded-4 border border-separator bg-bg-l1 shadow-elevated"
      >
        <div className="flex flex-col gap-2 px-4 pt-4 pb-2">
          <input
            ref={titleRef}
            type="text"
            aria-label="To-do title"
            placeholder="What to do?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-headline text-label outline-none placeholder:text-label-tertiary"
          />

          {showNotes ? (
            <textarea
              ref={notesRef}
              aria-label="Notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="block w-full resize-none bg-transparent text-callout text-label outline-none placeholder:text-label-tertiary"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="inline-flex items-center gap-1.5 self-start rounded-2 px-1.5 py-0.5 text-footnote text-label-secondary transition-colors hover:bg-bg-l3 hover:text-label"
            >
              <Plus className="size-3.5" aria-hidden />
              <span>Add notes</span>
            </button>
          )}
        </div>

        {/* Toolbar pills */}
        <div className="flex flex-wrap items-center gap-1 border-t border-separator/40 px-3 py-2">
          <ToolPill
            label={whenDesc.label}
            icon={whenDesc.icon}
            tint={whenDesc.tint}
            {...(whenDesc.fill ? { fill: true } : {})}
            ariaLabel="When"
            onClick={(e) => openPicker('when', e)}
          />
          <ListPill list={list} onClick={(e) => openPicker('list', e)} />
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-separator/40 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2 px-3 py-1 text-footnote text-label-secondary hover:text-label"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={title.trim().length === 0}
            aria-label="Save"
            className="inline-flex h-7 items-center rounded-full bg-tint px-3 text-footnote font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Save&nbsp;<span className="opacity-80">(⌘↵)</span>
          </button>
        </footer>
      </motion.div>

      {picker?.kind === 'when' && (
        <DatePicker
          anchor={picker.anchor}
          value={schedule}
          onChange={(next) => setSchedule(next)}
          onClose={() => setPicker(null)}
        />
      )}

      {picker?.kind === 'list' && (
        <ListPicker
          anchor={picker.anchor}
          projects={store?.projects ?? []}
          value={list}
          onSelect={(next) => {
            setList(next);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}

function ToolPill({
  label,
  icon: Icon,
  tint,
  fill,
  ariaLabel,
  onClick,
  children,
}: {
  label: ReactNode;
  icon: LucideIcon;
  tint: string;
  fill?: boolean;
  ariaLabel: string;
  onClick(e: React.MouseEvent<HTMLButtonElement>): void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className="inline-flex items-center gap-1.5 rounded-2 px-1.5 py-0.5 text-footnote text-label transition-colors hover:bg-bg-l3"
    >
      <Icon
        className={cn('size-3.5 shrink-0', tint)}
        fill={fill ? 'currentColor' : 'none'}
        aria-hidden
      />
      <span className="font-semibold text-label">{label}</span>
      {children}
    </button>
  );
}

function ListPill({
  list,
  onClick,
}: {
  list: ListChoice;
  onClick(e: React.MouseEvent<HTMLButtonElement>): void;
}) {
  if (list.kind === 'project') {
    return (
      <button
        type="button"
        aria-label="List"
        onClick={onClick}
        onMouseDown={(e) => e.preventDefault()}
        className="inline-flex items-center gap-1.5 rounded-2 px-1.5 py-0.5 text-footnote text-label transition-colors hover:bg-bg-l3"
      >
        <span className={cn('size-2 shrink-0 rounded-full', COLOR_BG[list.color])} aria-hidden />
        <span className="font-semibold text-label">{list.label}</span>
      </button>
    );
  }
  return (
    <ToolPill
      label={list.label}
      icon={list.icon}
      tint={list.tint}
      {...(list.fill ? { fill: true } : {})}
      ariaLabel="List"
      onClick={onClick}
    />
  );
}

/**
 * Inline list picker for the "List" toolbar pill. Lists the four fixed
 * sections and any user-defined projects.
 */
function ListPicker({
  anchor,
  projects,
  value,
  onSelect,
  onClose,
}: {
  anchor: { x: number; y: number };
  projects: Project[];
  value: ListChoice;
  onSelect(next: ListChoice): void;
  onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(anchor.x, vw - rect.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(anchor.y, vh - rect.height - 8))}px`;
  }, [anchor]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const projectChoices: Array<Extract<ListChoice, { kind: 'project' }>> = projects.map((p) => ({
    kind: 'project',
    id: p.id,
    label: p.title,
    color: p.color,
  }));

  const isCurrent = (c: ListChoice) =>
    c.kind === value.kind && c.id === value.id;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Pick list"
      data-testid="list-picker"
      className="fixed left-0 top-0 z-50 w-[240px] rounded-2 border border-separator bg-bg-l1 p-2 shadow-elevated"
    >
      <div role="listbox" aria-label="Sections" className="flex flex-col gap-0.5">
        {SECTION_CHOICES.map((s) => (
          <SectionRow
            key={s.id}
            choice={s}
            selected={isCurrent(s)}
            onClick={() => onSelect(s)}
          />
        ))}
      </div>
      {projectChoices.length > 0 && (
        <>
          <div className="my-1 h-px bg-separator" role="separator" />
          <div
            role="listbox"
            aria-label="Projects"
            className="max-h-[200px] overflow-y-auto"
          >
            {projectChoices.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={isCurrent(p)}
                onClick={() => onSelect(p)}
                className={cn(
                  'flex h-7 w-full items-center gap-2 rounded-2 px-2 text-left text-footnote text-label transition-colors hover:bg-bg-l3',
                  isCurrent(p) && 'bg-bg-l3',
                )}
              >
                <span
                  className={cn('size-2 shrink-0 rounded-full', COLOR_BG[p.color])}
                  aria-hidden
                />
                <span className="flex-1 truncate">{p.label}</span>
                {isCurrent(p) && (
                  <span className={cn('text-caption', COLOR_TEXT[p.color])} aria-hidden>
                    <X className="size-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionRow({
  choice,
  selected,
  onClick,
}: {
  choice: Extract<ListChoice, { kind: 'section' }>;
  selected: boolean;
  onClick(): void;
}) {
  const Icon = choice.icon;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-2 px-2 text-left text-footnote text-label transition-colors hover:bg-bg-l3',
        selected && 'bg-bg-l3',
      )}
    >
      <Icon
        className={cn('size-3.5 shrink-0', choice.tint)}
        fill={choice.fill ? 'currentColor' : 'none'}
        aria-hidden
      />
      <span className="flex-1">{choice.label}</span>
    </button>
  );
}
