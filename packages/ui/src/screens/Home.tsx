import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, Reorder, motion } from 'motion/react';
import {
  Archive,
  Calendar,
  CalendarDays,
  CheckSquare,
  Circle,
  Inbox,
  Layers,
  Plus,
  Search,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { Area, Project, Recurrence, Todo } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { COLOR_TEXT } from '../lib/palette';
import { getLucide } from '../lib/icons';
import { newId } from '../lib/id';
import { duration, easeOut, tween } from '../lib/motion';
import { useStore, type BulkTodoPatch, type TodoInput, type TodoPatch } from '../lib/store';
import { useShortcut, useCustomEvent, QUICK_ENTRY_OPEN_EVENT } from '../lib/shortcuts';
import { DragProvider } from '../lib/DragContext';
import { MagicPlus, type MagicPlusDropPayload } from '../components/MagicPlus';
import { QuickEntry, type QuickEntryDefault } from '../components/QuickEntry';
import { Sidebar, type Selection, type SectionId } from '../components/Sidebar';
import { AreaForm } from '../components/AreaForm';
import { ProjectForm } from '../components/ProjectForm';
import {
  NewTodoRow,
  type DraftScheduleOverride,
  type NewTodoDraft,
  type ScheduleHint,
} from '../components/NewTodoRow';
import { TodoRow } from '../components/TodoRow';
import { TodoDetail } from '../components/TodoDetail';
import { HeadingRow } from '../components/HeadingRow';
import { RowContextMenu, type RowContextAction } from '../components/RowContextMenu';
import {
  DatePicker,
  type DatePickerValue,
  type DatePickerWhen,
} from '../components/DatePicker';
import { RecurrencePicker } from '../components/RecurrencePicker';
import { ProgressIcon, type ProgressIconInner } from '../components/ProgressIcon';

type SectionMeta = { title: string; icon: LucideIcon; tint: string; fill?: boolean };

const SECTION_META: Record<SectionId, SectionMeta> = {
  inbox:    { title: 'Inbox',    icon: Inbox,        tint: 'text-blue' },
  today:    { title: 'Today',    icon: Star,         tint: 'text-yellow', fill: true },
  upcoming: { title: 'Upcoming', icon: CalendarDays, tint: 'text-red' },
  anytime:  { title: 'Anytime',  icon: Layers,       tint: 'text-teal' },
  someday:  { title: 'Someday',  icon: Archive,      tint: 'text-tan' },
  logbook:  { title: 'Logbook',  icon: CheckSquare,  tint: 'text-green' },
};

function deriveScheduleHint(
  selection: Selection,
  selectedProject: Project | null,
): ScheduleHint {
  if (selection.kind === 'project' && selectedProject) {
    return { label: selectedProject.title, icon: Inbox, tint: 'text-blue' };
  }
  const id = (selection as { kind: 'section'; id: SectionId }).id;
  const meta = SECTION_META[id];
  const hint: ScheduleHint = { label: meta.title, icon: meta.icon, tint: meta.tint };
  if (meta.fill) hint.fill = true;
  return hint;
}

function deriveRowTint(
  selection: Selection,
  selectedProject: Project | null,
): string {
  if (selection.kind === 'project' && selectedProject) {
    return COLOR_TEXT[selectedProject.color];
  }
  return SECTION_META[(selection as { kind: 'section'; id: SectionId }).id].tint;
}

function defaultsForDraft(selection: Selection): TodoInput {
  if (selection.kind === 'project') return { title: '', projectId: selection.id };
  switch (selection.id) {
    case 'today':
      return { title: '', scheduledWhen: 'today' };
    case 'someday':
      return { title: '', scheduledWhen: 'someday' };
    default:
      return { title: '' };
  }
}

/**
 * Pure helper: given a Magic-Plus drop payload and (for row-above/-below) the
 * anchor todo, builds the `TodoInput` to commit. Exported for unit tests so
 * the routing logic can be exercised without driving motion's drag pipeline
 * end-to-end (which is fiddly under happy-dom).
 */
export function buildMagicPlusInput(
  payload: MagicPlusDropPayload,
  newTodoId: string,
  anchor: Todo | null,
): TodoInput {
  switch (payload.kind) {
    case 'sidebar-section': {
      const sectionDefaults = defaultsForDraft({
        kind: 'section',
        id: payload.targetId as SectionId,
      });
      return { ...sectionDefaults, id: newTodoId, title: 'New To-Do' };
    }
    case 'sidebar-project':
      return { id: newTodoId, title: 'New To-Do', projectId: payload.targetId };
    case 'sidebar-area':
      return { id: newTodoId, title: 'New To-Do', areaId: payload.targetId };
    case 'row-above':
    case 'row-below':
      return {
        id: newTodoId,
        title: 'New To-Do',
        ...(anchor?.projectId ? { projectId: anchor.projectId } : {}),
        ...(anchor?.areaId ? { areaId: anchor.areaId } : {}),
        ...(anchor?.scheduledWhen ? { scheduledWhen: anchor.scheduledWhen } : {}),
        ...(anchor?.headingId ? { headingId: anchor.headingId } : {}),
      };
  }
}

/**
 * Strip the `-above`/`-below` suffix off a row-band target id to recover the
 * referenced todo id. No-op for any other drop kind.
 */
export function anchorIdFor(payload: MagicPlusDropPayload): string | null {
  if (payload.kind !== 'row-above' && payload.kind !== 'row-below') return null;
  const suffix = payload.kind === 'row-above' ? '-above' : '-below';
  return payload.targetId.endsWith(suffix)
    ? payload.targetId.slice(0, -suffix.length)
    : payload.targetId;
}

type AreaModal =
  | { mode: 'create' }
  | { mode: 'edit'; area: Area };

type ProjectModal =
  | { mode: 'create'; areaId: string | null }
  | { mode: 'edit'; project: Project };

type RowMenuState = {
  x: number;
  y: number;
  todoId: string;
};

type PickerKind = 'date' | 'recurrence';

/**
 * Active picker popover. `target` is either an existing todo id or the
 * sentinel `'draft'` (the unsaved NewTodoRow). DatePicker drives both
 * scheduling and recurrence editing per the Things3 collapsed shape.
 */
type PickerState = {
  kind: PickerKind;
  target: string | 'draft';
  anchor: { x: number; y: number };
};

/**
 * Translate the DatePicker's external `'today-evening' | 'anytime'` shorthand
 * into the store's narrower `scheduledWhen` enum + `eveningOnToday` flag. Kept
 * pure so callers can build either a `TodoPatch` (existing rows) or a draft.
 */
interface ResolvedSchedule {
  scheduledWhen: 'today' | 'someday' | null;
  scheduledFor: number | null;
  eveningOnToday: boolean;
}

function applyPickerValue(value: DatePickerValue): ResolvedSchedule {
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
    // 'anytime' and null fall through to the default cleared state.
    case 'anytime':
    case null:
    case undefined:
      break;
  }
  return out;
}

/**
 * Build the schedule-pill override for `NewTodoRow` from a draft picker value.
 * Returns `undefined` when the picker hasn't been opened so the row falls back
 * to its section-derived `scheduleHint`.
 */
function deriveDraftOverride(
  draftSchedule: DatePickerValue | null,
  fallback: ScheduleHint,
): DraftScheduleOverride | undefined {
  if (!draftSchedule) return undefined;
  const hasAny =
    draftSchedule.scheduledWhen !== undefined ||
    draftSchedule.scheduledFor !== undefined ||
    draftSchedule.recurrence !== undefined;
  if (!hasAny) return undefined;
  const resolved = applyPickerValue(draftSchedule);
  let hint: ScheduleHint = fallback;
  if (typeof resolved.scheduledFor === 'number') {
    const d = new Date(resolved.scheduledFor);
    hint = {
      label: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d),
      icon: CalendarDays,
      tint: 'text-tint',
    };
  } else if (resolved.scheduledWhen === 'today') {
    hint = resolved.eveningOnToday
      ? { label: 'Today, Evening', icon: Star, tint: 'text-yellow', fill: true }
      : { label: 'Today', icon: Star, tint: 'text-yellow', fill: true };
  } else if (resolved.scheduledWhen === 'someday') {
    hint = { label: 'Someday', icon: Archive, tint: 'text-tan' };
  }
  return {
    hint,
    draft: {
      scheduledWhen: resolved.scheduledWhen,
      scheduledFor: resolved.scheduledFor,
      eveningOnToday: resolved.eveningOnToday,
      recurrence: draftSchedule.recurrence ?? null,
    },
  };
}

/** Read back a `Todo`'s current scheduling as a `DatePickerValue`. */
function todoToPickerValue(t: Todo): DatePickerValue {
  let when: DatePickerWhen | null = null;
  if (t.scheduledWhen === 'today') {
    when = t.eveningOnToday ? 'today-evening' : 'today';
  } else if (t.scheduledWhen === 'someday') {
    when = 'someday';
  }
  return {
    scheduledWhen: when,
    scheduledFor: t.scheduledFor ?? null,
    recurrence: t.recurrence ?? null,
  };
}

export function Home() {
  const store = useStore();
  const [selection, setSelection] = useState<Selection>({ kind: 'section', id: 'today' });
  // `pendingDone` holds rows whose checkbox was just flipped — they render as
  // done locally, run the strike-through, and after the hold + exit animation
  // we flush them via `store.updateTodo({done:true})`. Without this two-phase
  // model the row would vanish before the user sees the check moment.
  const [pendingDone, setPendingDone] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSchedule, setDraftSchedule] = useState<DatePickerValue | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [areaModal, setAreaModal] = useState<AreaModal | null>(null);
  const [projectModal, setProjectModal] = useState<ProjectModal | null>(null);
  // Inline "Add Heading" affordance at the bottom of a project view. Holds the
  // title draft so Enter/blur know what to commit. Null = button not yet clicked.
  const [headingDraft, setHeadingDraft] = useState<string | null>(null);
  // Phase 5: floating Quick Entry panel — opens on Cmd+Space (window-focused)
  // or via the global-shortcut bridge dispatched from the Tauri layer.
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);

  // Re-entrancy guard so the timeout chain doesn't double-commit a row.
  const exitTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = exitTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const selectedProject = useMemo(
    () =>
      selection.kind === 'project'
        ? store.projects.find((p) => p.id === selection.id) ?? null
        : null,
    [selection, store.projects],
  );

  const visible = useMemo<Todo[]>(() => {
    if (selection.kind === 'project') {
      return store.todos.filter((t) => t.projectId === selection.id);
    }
    const all = store.todos;
    switch (selection.id) {
      case 'inbox':
        return all.filter((t) => !t.projectId && !t.areaId && !t.done && !t.scheduledWhen);
      case 'today':
        return all.filter((t) => !t.done && t.scheduledWhen === 'today');
      case 'someday':
        return all.filter((t) => !t.done && t.scheduledWhen === 'someday');
      case 'anytime':
        return all.filter((t) => !t.done && t.scheduledWhen !== 'someday');
      case 'upcoming':
        return all.filter(
          (t) => !t.done && typeof t.scheduledFor === 'number' && t.scheduledFor > Date.now(),
        );
      case 'logbook':
        return all.filter((t) => t.done);
      default:
        return [];
    }
  }, [store.todos, selection]);

  // Drop selected ids that are no longer in the visible list (e.g. selection
  // changed or a row was deleted).
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(visible.map((t) => t.id));
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
    if (expandedId && !visible.some((t) => t.id === expandedId)) {
      setExpandedId(null);
    }
  }, [visible, expandedId]);

  const rowTint = useMemo(
    () => deriveRowTint(selection, selectedProject),
    [selection, selectedProject],
  );

  /**
   * Per-project completion 0..1, computed once per `todos` change and cached
   * by project id. Drives the sidebar + header ProgressIcon. A project with
   * zero todos reads 0 (empty ring) — matches Things3 (no fill until work
   * exists).
   */
  const projectProgressMap = useMemo(() => {
    const totals = new Map<string, { total: number; done: number }>();
    for (const t of store.todos) {
      if (!t.projectId) continue;
      const cur = totals.get(t.projectId) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (t.done) cur.done += 1;
      totals.set(t.projectId, cur);
    }
    const ratios = new Map<string, number>();
    for (const [id, { total, done }] of totals) {
      ratios.set(id, total === 0 ? 0 : done / total);
    }
    return ratios;
  }, [store.todos]);

  const projectProgress = useCallback(
    (id: string) => projectProgressMap.get(id) ?? 0,
    [projectProgressMap],
  );

  const scheduleHint = useMemo<ScheduleHint>(
    () => deriveScheduleHint(selection, selectedProject),
    [selection, selectedProject],
  );

  const startDraft = useCallback(() => {
    setDraftId(newId());
    setDraftSchedule(null);
  }, []);
  const cancelDraft = useCallback(() => {
    setDraftId(null);
    setDraftSchedule(null);
  }, []);

  const commitDraft = useCallback(
    async (draft: NewTodoDraft) => {
      const cleanDraft = Object.fromEntries(
        Object.entries(draft).filter(([, v]) => v !== null),
      ) as unknown as TodoInput;
      const input: TodoInput = { ...defaultsForDraft(selection), ...cleanDraft };
      await store.addTodo(input);
      setDraftSchedule(null);
    },
    [selection, store],
  );

  /**
   * Two-phase complete: mark `pendingDone` so the row renders as done +
   * runs the strike anim, then after `rowHold` flush the actual store
   * update. `AnimatePresence` `exit` handles the slide-up.
   */
  const completeTodo = useCallback(
    (id: string) => {
      if (exitTimers.current.has(id)) return;
      setPendingDone((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      const timer = setTimeout(() => {
        exitTimers.current.delete(id);
        setPendingDone((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        // Mirror `TodoStore.toggle` semantics: flips done + sets completedAt.
        void store.bulkUpdateTodos([id], { done: true } satisfies BulkTodoPatch);
      }, (duration.check + duration.rowHold) * 1000);
      exitTimers.current.set(id, timer);
    },
    [store],
  );

  const uncompleteTodo = useCallback(
    (id: string) => {
      const existing = exitTimers.current.get(id);
      if (existing) {
        clearTimeout(existing);
        exitTimers.current.delete(id);
        setPendingDone((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }
      void store.bulkUpdateTodos([id], { done: false } satisfies BulkTodoPatch);
    },
    [store],
  );

  const toggleTodo = useCallback(
    (todo: Todo) => {
      if (todo.done || pendingDone.has(todo.id)) {
        uncompleteTodo(todo.id);
      } else {
        completeTodo(todo.id);
      }
    },
    [pendingDone, completeTodo, uncompleteTodo],
  );

  const handleSelect = useCallback(
    (todo: Todo, mods: { meta: boolean; shift: boolean }) => {
      setExpandedId(null);
      const idsInOrder = visible.map((t) => t.id);
      setSelected((prev) => {
        if (mods.shift && lastSelected) {
          const a = idsInOrder.indexOf(lastSelected);
          const b = idsInOrder.indexOf(todo.id);
          if (a < 0 || b < 0) return new Set([todo.id]);
          const [from, to] = a < b ? [a, b] : [b, a];
          const range = idsInOrder.slice(from, to + 1);
          return new Set(range);
        }
        if (mods.meta) {
          const next = new Set(prev);
          if (next.has(todo.id)) next.delete(todo.id);
          else next.add(todo.id);
          return next;
        }
        return new Set([todo.id]);
      });
      setLastSelected(todo.id);
    },
    [visible, lastSelected],
  );

  const handleOpen = useCallback(
    (todo: Todo) => {
      setExpandedId((prev) => (prev === todo.id ? null : todo.id));
    },
    [],
  );

  const handleContextMenu = useCallback(
    (todo: Todo, e: React.MouseEvent) => {
      e.preventDefault();
      // If the row isn't part of the current multi-select, replace selection
      // so the menu's "Delete N" reads truthfully.
      if (!selected.has(todo.id)) {
        setSelected(new Set([todo.id]));
        setLastSelected(todo.id);
      }
      setRowMenu({ x: e.clientX, y: e.clientY, todoId: todo.id });
    },
    [selected],
  );

  const menuTargetIds = useMemo(() => {
    if (!rowMenu) return [] as string[];
    if (selected.has(rowMenu.todoId) && selected.size > 1) {
      return Array.from(selected);
    }
    return [rowMenu.todoId];
  }, [rowMenu, selected]);

  const menuTargets = useMemo(
    () =>
      menuTargetIds
        .map((id) => store.todos.find((t) => t.id === id))
        .filter((t): t is Todo => Boolean(t)),
    [menuTargetIds, store.todos],
  );

  const handleAction = useCallback(
    async (action: RowContextAction) => {
      const ids = menuTargetIds;
      if (ids.length === 0) return;
      const anchor = rowMenu ? { x: rowMenu.x, y: rowMenu.y } : { x: 80, y: 80 };
      switch (action) {
        case 'complete': {
          const anyOpen = menuTargets.some((t) => !t.done && !pendingDone.has(t.id));
          if (anyOpen) {
            for (const id of ids) completeTodo(id);
          } else {
            await store.bulkUpdateTodos(ids, { done: false } satisfies BulkTodoPatch);
          }
          break;
        }
        case 'flag': {
          const flagged = !menuTargets.every((t) => t.flagged);
          await store.bulkUpdateTodos(ids, { flagged } satisfies BulkTodoPatch);
          break;
        }
        case 'delete': {
          if (
            typeof window !== 'undefined' &&
            !window.confirm(
              ids.length > 1
                ? `Delete ${ids.length} to-dos?`
                : 'Delete this to-do?',
            )
          ) {
            return;
          }
          for (const id of ids) await store.removeTodo(id);
          setSelected(new Set());
          break;
        }
        case 'schedule':
        case 'when': {
          // Things3 collapses "When" and "Schedule" — both open DatePicker. We
          // target the row that triggered the menu (multi-select scheduling
          // is intentionally a Wave-3 follow-up so the picker can't ambiguate).
          const targetId = ids[0];
          if (!targetId) break;
          setPicker({ kind: 'date', target: targetId, anchor });
          break;
        }
        case 'repeat': {
          const targetId = ids[0];
          if (!targetId) break;
          setPicker({ kind: 'recurrence', target: targetId, anchor });
          break;
        }
        case 'move':
        default:
          break;
      }
    },
    [menuTargetIds, menuTargets, pendingDone, store, completeTodo, rowMenu],
  );

  /**
   * Commit reorder by translating motion's new array-of-Todos into the
   * single-id-move shape our store expects. We only act on the row that
   * moved (id mismatch with previous position).
   */
  const handleReorder = useCallback(
    (next: Todo[]) => {
      // Map visible-list reorders back into the underlying `order` array so
      // the project/section filter stays a stable subsequence.
      const visibleIds = visible.map((t) => t.id);
      const newIds = next.map((t) => t.id);
      // Find first divergence: that's the dragged row's new position.
      let movedId: string | null = null;
      let newVisibleIdx = -1;
      for (let i = 0; i < newIds.length; i++) {
        if (newIds[i] !== visibleIds[i]) {
          movedId = newIds[i] ?? null;
          newVisibleIdx = i;
          break;
        }
      }
      if (!movedId) return;
      // Translate visible index → global `order` index by anchoring on the
      // todo currently occupying that visible slot.
      const allOrderedIds = store.todos.map((t) => t.id);
      // Build the would-be visible list around movedId at newVisibleIdx, then
      // pick the global index by looking at neighbour anchors.
      const beforeAnchor =
        newVisibleIdx > 0 ? newIds[newVisibleIdx - 1] : null;
      let targetGlobalIdx: number;
      if (beforeAnchor) {
        const anchorIdx = allOrderedIds.indexOf(beforeAnchor);
        targetGlobalIdx = anchorIdx + 1;
        // If movedId is currently before anchor, the array shift means we
        // want the same position; splice() handles this when we remove first.
        const movedGlobalIdx = allOrderedIds.indexOf(movedId);
        if (movedGlobalIdx < anchorIdx) targetGlobalIdx = anchorIdx;
      } else {
        // Moved to the top of the visible list → place before the original
        // first visible row in the global order.
        const firstAfter = newIds[1];
        if (firstAfter) {
          targetGlobalIdx = allOrderedIds.indexOf(firstAfter);
          if (targetGlobalIdx < 0) targetGlobalIdx = 0;
        } else {
          targetGlobalIdx = 0;
        }
      }
      void store.reorderTodo(movedId, targetGlobalIdx);
    },
    [visible, store],
  );

  // Cmd/Ctrl+A → select all visible; Escape → clear selection/expansion.
  // Kept as a single effect because they're tightly coupled to current
  // visible/selected state and not worth a dedicated registry entry.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (areaModal || projectModal) return;
      const target = e.target as HTMLElement | null;
      const inEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A') && !inEditable) {
        if (visible.length === 0) return;
        e.preventDefault();
        setSelected(new Set(visible.map((t) => t.id)));
        return;
      }

      if (e.key === 'Escape' && (selected.size > 0 || expandedId)) {
        e.preventDefault();
        setSelected(new Set());
        setExpandedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [areaModal, projectModal, visible, selected, expandedId]);

  // Cmd/Ctrl+N → start a new draft (Things3 inline-add). Works even when
  // focus is in an input/textarea (matches the previous behaviour). Skipped
  // when a modal is up so the modal's own controls keep typing.
  const onNewShortcut = useCallback(
    (e: KeyboardEvent) => {
      if (areaModal || projectModal || quickEntryOpen) return;
      e.preventDefault();
      setDraftId(newId());
      setDraftSchedule(null);
    },
    [areaModal, projectModal, quickEntryOpen],
  );
  useShortcut({ key: 'n', meta: true, handler: onNewShortcut, evenInEditable: true });

  // Bare 'n' (no modifiers) also opens a draft — but only when focus is
  // *outside* an editable field, so typing the letter still works.
  useShortcut({
    key: 'n',
    handler: (e) => {
      if (areaModal || projectModal || quickEntryOpen) return;
      e.preventDefault();
      setDraftId(newId());
      setDraftSchedule(null);
    },
  });

  // Phase 5: Cmd/Ctrl+Space → Quick Entry panel. Window-focused only on web
  // (browser keydown). Tauri layer surfaces a *global* shortcut via the
  // `global-shortcut` plugin → emits a Tauri event → web layer re-dispatches
  // it as the custom DOM event subscribed to below.
  const onQuickEntryShortcut = useCallback(
    (e: KeyboardEvent) => {
      if (areaModal || projectModal) return;
      e.preventDefault();
      setQuickEntryOpen(true);
    },
    [areaModal, projectModal],
  );
  useShortcut({
    key: ' ',
    meta: true,
    handler: onQuickEntryShortcut,
    evenInEditable: true,
  });
  useCustomEvent(QUICK_ENTRY_OPEN_EVENT, () => {
    if (areaModal || projectModal) return;
    setQuickEntryOpen(true);
  });

  const quickEntryDefault = useMemo<QuickEntryDefault>(() => {
    if (selection.kind === 'project') return { kind: 'project', id: selection.id };
    return { kind: 'section', id: selection.id };
  }, [selection]);

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

  // Project-scoped headings, ordered. Computed even when not on a project view
  // so the hook order stays stable; we just don't render them elsewhere.
  const projectHeadings = useMemo(() => {
    if (selection.kind !== 'project') return [];
    return store.headings
      .filter((h) => h.projectId === selection.id)
      .sort((a, b) => a.order - b.order);
  }, [store.headings, selection]);

  const isProjectView = selection.kind === 'project';
  const isTodayView = selection.kind === 'section' && selection.id === 'today';

  // Today split: partition rows by "morning" vs "evening" buckets so the
  // section can render two headed groups (or fall back to a single un-headed
  // group when only one bucket has content — matches Things3).
  const morningTodos = useMemo(
    () => (isTodayView ? visible.filter((t) => !t.eveningOnToday) : []),
    [isTodayView, visible],
  );
  const eveningTodos = useMemo(
    () => (isTodayView ? visible.filter((t) => t.eveningOnToday === true) : []),
    [isTodayView, visible],
  );
  const todayShowHeaders =
    isTodayView && morningTodos.length > 0 && eveningTodos.length > 0;
  const todayOnlyEvening =
    isTodayView && morningTodos.length === 0 && eveningTodos.length > 0;

  // In project view we never short-circuit the layout to the empty placeholder:
  // the "Add Heading" affordance lives at the bottom of that layout and the
  // user must always be able to reach it. A small placeholder is rendered
  // inline above the button when truly empty.
  const projectIsEmpty =
    isProjectView && visible.length === 0 && projectHeadings.length === 0 && !draftId;
  const showSectionPlaceholder =
    selection.kind === 'section' &&
    visible.length === 0 &&
    !draftId;

  /**
   * Render a draggable+animated group of todo rows. Each call instantiates its
   * own `Reorder.Group` so drag-reorder stays scoped within a partition (Today
   * morning vs evening, project headings). Cross-group drag is intentionally
   * out of scope for this wave.
   */
  const renderTodoGroup = (items: Todo[], key?: string) => (
    <Reorder.Group
      key={key}
      as="ul"
      axis="y"
      values={items}
      onReorder={handleReorder}
      className="flex flex-col"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const isPending = pendingDone.has(t.id);
          const displayedDone = t.done || isPending;
          const isExpanded = expandedId === t.id;
          return (
            <Reorder.Item
              key={t.id}
              value={t}
              layout
              dragListener={!isExpanded}
              initial={{ opacity: 1, height: 'auto' }}
              exit={{
                opacity: 0,
                height: 0,
                y: -4,
                paddingTop: 0,
                paddingBottom: 0,
                marginTop: 0,
                marginBottom: 0,
                transition: { duration: duration.rowOut, ease: easeOut },
              }}
              transition={tween}
              className="list-none"
            >
              <TodoRow
                todo={t}
                done={displayedDone}
                tint={rowTint}
                selected={selected.has(t.id)}
                expanded={isExpanded}
                detail={
                  isExpanded && (
                    <TodoDetail
                      todo={t}
                      onPatch={(patch) => void store.updateTodo(t.id, patch)}
                      onDelete={() => {
                        if (
                          typeof window !== 'undefined' &&
                          !window.confirm('Delete this to-do?')
                        ) {
                          return;
                        }
                        setExpandedId(null);
                        void store.removeTodo(t.id);
                      }}
                      onClose={() => setExpandedId(null)}
                      onOpenWhen={() => {
                        const row = document.querySelector<HTMLElement>(
                          `[data-testid="todo-row-${t.id}"]`,
                        );
                        const rect = row?.getBoundingClientRect();
                        setPicker({
                          kind: 'date',
                          target: t.id,
                          anchor: rect
                            ? { x: rect.left + 24, y: rect.bottom + 4 }
                            : { x: 80, y: 80 },
                        });
                      }}
                    />
                  )
                }
                onToggle={() => toggleTodo(t)}
                onSelect={(mods) => handleSelect(t, mods)}
                onOpen={() => handleOpen(t)}
                onContextMenu={(e) => handleContextMenu(t, e)}
              />
            </Reorder.Item>
          );
        })}
      </AnimatePresence>
    </Reorder.Group>
  );

  /**
   * Magic-Plus drop handler. Builds the right `TodoInput` for the drop kind,
   * creates the new todo with a pre-allocated id (so we can immediately
   * expand its detail editor), and — for row-above/-below drops — reorders
   * into the adjacent slot. The new row's title is empty; the inline detail
   * editor focuses its title input so the user types in place (mirrors the
   * Things3 magic-plus-to-filing flow).
   */
  const handleMagicPlusDrop = useCallback(
    (payload: MagicPlusDropPayload) => {
      const newTodoId = newId();
      const anchorId = anchorIdFor(payload);
      const anchor = anchorId
        ? store.todos.find((t) => t.id === anchorId) ?? null
        : null;
      const input = buildMagicPlusInput(payload, newTodoId, anchor);

      // Side-effect: drops onto a sidebar row also switch the selection so
      // the user lands in the same bucket their new todo just joined.
      switch (payload.kind) {
        case 'sidebar-section':
          setSelection({ kind: 'section', id: payload.targetId as SectionId });
          break;
        case 'sidebar-project':
          setSelection({ kind: 'project', id: payload.targetId });
          break;
      }

      void (async () => {
        await store.addTodo(input);
        if (
          (payload.kind === 'row-above' || payload.kind === 'row-below') &&
          anchorId
        ) {
          const orderedIds = store.todos.map((t) => t.id);
          const anchorIdx = orderedIds.indexOf(anchorId);
          if (anchorIdx >= 0) {
            // -above places at the anchor's slot (pushing it down); -below
            // places immediately after.
            const targetIdx =
              payload.kind === 'row-above' ? anchorIdx : anchorIdx + 1;
            await store.reorderTodo(newTodoId, targetIdx);
          }
        }
        // Auto-open the detail editor so the user can type the title.
        setExpandedId(newTodoId);
      })();
    },
    [store],
  );

  const commitNewHeading = (raw: string) => {
    if (selection.kind !== 'project') return;
    const title = raw.trim();
    if (title.length === 0) {
      setHeadingDraft(null);
      return;
    }
    void store.addHeading({
      id: newId(),
      projectId: selection.id,
      title,
      order: projectHeadings.length,
    });
    setHeadingDraft(null);
  };

  return (
    <DragProvider>
    <div className="flex h-full w-full bg-bg-l2 text-label">
      <Sidebar
        selection={selection}
        onSelect={(s) => {
          setSelection(s);
          setSelected(new Set());
          setExpandedId(null);
          setHeadingDraft(null);
        }}
        areas={store.areas}
        projects={store.projects}
        onCreateArea={() => setAreaModal({ mode: 'create' })}
        onCreateProject={(areaId) => setProjectModal({ mode: 'create', areaId })}
        onEditArea={(area) => setAreaModal({ mode: 'edit', area })}
        onEditProject={(project) => setProjectModal({ mode: 'edit', project })}
        onDeleteArea={handleDeleteArea}
        onDeleteProject={handleDeleteProject}
        projectProgress={projectProgress}
      />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="px-8 pt-8 pb-3">
          <div className="mx-auto w-full max-w-2xl">
            {selection.kind === 'project' && selectedProject ? (
              <ProjectHeader
                project={selectedProject}
                progress={projectProgress(selectedProject.id)}
              />
            ) : (
              <SectionHeader meta={SECTION_META[(selection as { kind: 'section'; id: SectionId }).id]} />
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2">
          <div className="mx-auto w-full max-w-2xl">
            {showSectionPlaceholder ? (
              <Empty />
            ) : (
              <div className="flex flex-col">
                {draftId && (
                  <NewTodoRow
                    key={draftId}
                    scheduleHint={scheduleHint}
                    draftScheduleOverride={deriveDraftOverride(draftSchedule, scheduleHint)}
                    onCommit={async (draft) => {
                      await commitDraft(draft);
                      setDraftId(newId());
                    }}
                    onCancel={cancelDraft}
                    onBlurEmpty={cancelDraft}
                    onOpenSchedule={(a) =>
                      setPicker({ kind: 'date', target: 'draft', anchor: a })
                    }
                  />
                )}
                {isTodayView ? (
                  <>
                    {todayShowHeaders && (
                      <DayPartHeading>This Morning</DayPartHeading>
                    )}
                    {morningTodos.length > 0 && renderTodoGroup(morningTodos, 'morning')}
                    {todayOnlyEvening || todayShowHeaders ? (
                      <div className={todayShowHeaders ? 'mt-6' : undefined}>
                        <DayPartHeading>This Evening</DayPartHeading>
                        {renderTodoGroup(eveningTodos, 'evening')}
                      </div>
                    ) : null}
                  </>
                ) : isProjectView ? (
                  <>
                    {projectIsEmpty && <ProjectEmpty />}
                    {(() => {
                      const unsorted = visible.filter((t) => !t.headingId);
                      return (
                        <>
                          {unsorted.length > 0 && renderTodoGroup(unsorted, 'unsorted')}
                          {projectHeadings.map((h) => {
                            const headingTodos = visible.filter(
                              (t) => t.headingId === h.id,
                            );
                            return (
                              <div key={h.id}>
                                <HeadingRow
                                  heading={h}
                                  onRename={(title) =>
                                    void store.updateHeading(h.id, { title })
                                  }
                                  onDelete={() => void store.removeHeading(h.id)}
                                />
                                {headingTodos.length > 0 &&
                                  renderTodoGroup(headingTodos, `h-${h.id}`)}
                              </div>
                            );
                          })}
                          <AddHeadingButton
                            draft={headingDraft}
                            onStart={() => setHeadingDraft('')}
                            onChange={setHeadingDraft}
                            onCommit={commitNewHeading}
                            onCancel={() => setHeadingDraft(null)}
                          />
                        </>
                      );
                    })()}
                  </>
                ) : (
                  renderTodoGroup(visible)
                )}
              </div>
            )}
          </div>
        </div>

        <MagicPlus onClick={startDraft} onDrop={handleMagicPlusDrop} />

        <MainFooter onNew={startDraft} />
      </main>

      {rowMenu && menuTargets.length > 0 && (
        <RowContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          selectionCount={menuTargets.length}
          alreadyDone={menuTargets.every((t) => t.done)}
          alreadyFlagged={menuTargets.every((t) => t.flagged)}
          onAction={(a) => void handleAction(a)}
          onClose={() => setRowMenu(null)}
        />
      )}

      {picker?.kind === 'date' && (
        <DatePicker
          anchor={picker.anchor}
          value={
            picker.target === 'draft'
              ? draftSchedule ?? {}
              : (() => {
                  const t = store.todos.find((x) => x.id === picker.target);
                  return t ? todoToPickerValue(t) : {};
                })()
          }
          onChange={(next) => {
            if (picker.target === 'draft') {
              setDraftSchedule(next);
              return;
            }
            const resolved = applyPickerValue(next);
            const patch: TodoPatch = {
              scheduledWhen: resolved.scheduledWhen,
              eveningOnToday: resolved.eveningOnToday,
            };
            if (resolved.scheduledFor !== null) patch.scheduledFor = resolved.scheduledFor;
            if (next.recurrence) patch.recurrence = next.recurrence;
            void store.updateTodo(picker.target, patch);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker?.kind === 'recurrence' && (
        <RecurrencePicker
          anchor={picker.anchor}
          value={
            picker.target === 'draft'
              ? draftSchedule?.recurrence ?? null
              : (() => {
                  const t = store.todos.find((x) => x.id === picker.target);
                  return t?.recurrence ?? null;
                })()
          }
          onChange={(next: Recurrence | null) => {
            if (picker.target === 'draft') {
              setDraftSchedule((prev) => ({ ...(prev ?? {}), recurrence: next }));
              return;
            }
            void store.updateTodo(picker.target, next ? { recurrence: next } : {});
          }}
          onClose={() => setPicker(null)}
        />
      )}

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

      <AnimatePresence>
        {quickEntryOpen && (
          <QuickEntry
            key="quick-entry"
            defaultSelection={quickEntryDefault}
            onSave={async (input) => {
              await store.addTodo(input);
            }}
            onClose={() => setQuickEntryOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
    </DragProvider>
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

function ProjectHeader({ project, progress }: { project: Project; progress: number }) {
  const inner: ProgressIconInner =
    project.icon.kind === 'emoji'
      ? { kind: 'emoji', value: project.icon.value }
      : project.icon.kind === 'lucide'
        ? { kind: 'icon', lucide: getLucide(project.icon.name) }
        : { kind: 'dot' };
  return (
    <div className="flex items-center gap-2.5">
      <ProgressIcon size="md" color={project.color} progress={progress} inner={inner} />
      <h1 className="text-title font-bold tracking-tight text-label">{project.title}</h1>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center pt-24 text-center">
      <Circle className="size-8 text-label-tertiary" />
      <p className="mt-3 text-callout text-label-secondary">Nothing here yet</p>
      <p className="mt-1 text-footnote text-label-tertiary">Tap + or press ⌘N to add a to-do.</p>
    </div>
  );
}

function ProjectEmpty() {
  return (
    <div className="flex flex-col items-center justify-center pt-24 text-center">
      <Circle className="size-8 text-label-tertiary" />
      <p className="mt-3 text-callout text-label-secondary">No to-dos in this project yet</p>
      <p className="mt-1 text-footnote text-label-tertiary">Tap + or press ⌘N to add a to-do.</p>
    </div>
  );
}

function DayPartHeading({ children }: { children: ReactNode }) {
  // Things3 day-part header: 15px semibold label, snug to the rows below.
  return <h2 className="text-headline font-semibold text-label mt-3 mb-1">{children}</h2>;
}

/**
 * Project-view footer affordance for adding a new heading. Idle = plain pill
 * button; clicked = inline `<input>` that commits on Enter and cancels on Esc
 * or empty-blur. Mirrors the lightweight Things3 inline-add pattern.
 */
function AddHeadingButton({
  draft,
  onStart,
  onChange,
  onCommit,
  onCancel,
}: {
  draft: string | null;
  onStart(): void;
  onChange(next: string): void;
  onCommit(value: string): void;
  onCancel(): void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (draft !== null) inputRef.current?.focus();
  }, [draft]);

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={onStart}
        className="mt-6 inline-flex items-center gap-1.5 self-start text-callout text-label-secondary hover:text-label"
      >
        <Plus className="size-3.5" aria-hidden />
        <span>Add Heading</span>
      </button>
    );
  }

  return (
    <div className="mt-6 pb-2 border-b border-separator">
      <input
        ref={inputRef}
        type="text"
        aria-label="New heading title"
        placeholder="New Heading"
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit(draft);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (draft.trim().length === 0) onCancel();
          else onCommit(draft);
        }}
        className="w-full bg-transparent text-headline font-semibold text-label outline-none border-none p-0 placeholder:text-label-tertiary"
      />
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

function MainFooter({ onNew }: { onNew: () => void }) {
  return (
    <footer className="border-t border-separator bg-bg-l1 px-8 py-2" aria-label="Toolbar">
      <div className="flex items-center justify-center gap-16">
        <motion.button
          onClick={onNew}
          aria-label="New To-Do"
          whileTap={{ scale: 0.94 }}
          transition={{ duration: duration.fast }}
          className="inline-flex size-8 items-center justify-center rounded-full bg-tint text-white hover:opacity-90"
        >
          <Plus className="size-4" />
        </motion.button>
        <ToolbarBtn icon={Calendar} label="Schedule" />
        <ToolbarBtn icon={Search} label="Search" />
      </div>
    </footer>
  );
}
