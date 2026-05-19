import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { motion } from 'motion/react';
import { FileText, Flag, RotateCw } from 'lucide-react';
import type { Tag, Todo } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { duration, easeOut, tween } from '../lib/motion';
import { useDropTarget } from '../lib/DragContext';
import {
  deriveDeadline,
  deriveSchedulePill,
  formatDueShort,
} from '../lib/scheduleLabel';
import { summarizeRecurrence } from './DatePicker';
import { TagChip } from './TagChip';
import { useStoreOptional } from '../lib/store';

export type TodoRowClickModifiers = {
  meta: boolean;
  shift: boolean;
};

export interface TodoRowProps {
  todo: Todo;
  /** Visual `done` state — held locally by the parent so we can run the
   *  pop/strike/exit animation before the data layer drops the row. */
  done: boolean;
  /** Tailwind class for the checkbox tint (`text-yellow`, `text-blue`, …). */
  tint: string;
  selected?: boolean;
  expanded?: boolean;
  /** Renders inside the row's collapsible region — usually `<TodoDetail />`. */
  detail?: ReactNode;
  onToggle(): void;
  onSelect?(mods: TodoRowClickModifiers): void;
  onOpen?(): void;
  onContextMenu?(e: MouseEvent<HTMLDivElement>): void;
}

/**
 * Single canonical to-do row. Renders the Things3-style checkbox + title +
 * optional trail glyphs. The checkbox flip plays a 200ms scale pop and the
 * check path is drawn via `strokeDashoffset` so the tick "writes itself" each
 * time the row transitions to done.
 */
export const TodoRow = forwardRef<HTMLDivElement, TodoRowProps>(function TodoRow(
  {
    todo,
    done,
    tint,
    selected = false,
    expanded = false,
    detail,
    onToggle,
    onSelect,
    onOpen,
    onContextMenu,
  },
  ref,
) {
  // Tags come from the store so the row is self-contained — `useStoreOptional`
  // returns null when rendered outside `<StoreProvider>` (e.g. unit tests for
  // this component) so we degrade to an empty list without crashing.
  const storeMaybe = useStoreOptional();
  const tags = storeMaybe?.tags ?? [];

  // Track the transition into `done` so the check anim only fires on the flip,
  // not on every re-render (e.g. when a sibling row updates).
  const prevDone = useRef(done);
  const [justChecked, setJustChecked] = useState(false);
  useEffect(() => {
    if (done && !prevDone.current) {
      setJustChecked(true);
      const t = window.setTimeout(() => setJustChecked(false), 240);
      return () => window.clearTimeout(t);
    }
    prevDone.current = done;
    return undefined;
  }, [done]);

  const handleRowMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Ignore clicks that originate inside the checkbox / detail editor.
    if ((e.target as HTMLElement).closest('[data-todo-stop]')) return;
    onSelect?.({ meta: e.metaKey || e.ctrlKey, shift: e.shiftKey });
  };

  const handleTitleClick = () => {
    onOpen?.();
  };

  // Magic-Plus drop bands: two ~6px invisible strips above + below the row.
  // When a drag is hovering over either, the band's `isActive` flips and we
  // render a 2px tint-coloured insertion line at its center. The bands are
  // wider than they look (`-mx-1`) so the pointer doesn't have to be pixel
  // precise to "snap" to an above/below insertion.
  const aboveBand = useDropTarget(`${todo.id}-above`, 'row-above');
  const belowBand = useDropTarget(`${todo.id}-below`, 'row-below');

  return (
    <div
      ref={ref}
      data-testid={`todo-row-${todo.id}`}
      onMouseDown={handleRowMouseDown}
      onContextMenu={onContextMenu}
      className={cn(
        'group relative rounded-1 transition-colors',
        // Selected highlight stays visible even when expanded so users keep
        // track of multi-select while one row is open for editing.
        selected && 'bg-bg-l3 ring-1 ring-tint/30',
        !selected && 'hover:bg-bg-l3',
      )}
    >
      <div
        ref={aboveBand.ref}
        data-testid={`drop-above-${todo.id}`}
        data-drop-active={aboveBand.isActive ? 'true' : undefined}
        aria-hidden
        className="pointer-events-none absolute -top-1 -left-1 -right-1 h-1.5"
      >
        {aboveBand.isActive && (
          <span className="absolute top-1/2 left-0 right-0 h-px bg-tint" />
        )}
      </div>
      <div className="flex items-center gap-2 px-1 py-1">
        <button
          type="button"
          data-todo-stop
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-checked={done}
          role="checkbox"
          aria-label={done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
          className={cn(
            'inline-flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-colors',
            done
              ? cn('border-current', tint)
              : 'border-label-tertiary group-hover:border-label-secondary',
            justChecked && 'anim-check-pop',
          )}
        >
          {done && (
            <CheckGlyph
              key={justChecked ? 'animate' : 'static'}
              animate={justChecked}
              className={cn('size-2.5', tint)}
            />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleTitleClick();
          }}
          className="relative flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span
            data-done={done}
            className={cn(
              'relative text-body truncate',
              done ? 'text-label-tertiary' : 'text-label',
              // Animated strike: pseudo grows from 0 → 100% over 240ms; the
              // baseline `line-through` class is dropped so the line we draw
              // owns the visual.
              "after:pointer-events-none after:absolute after:left-0 after:top-1/2 after:h-px after:bg-current after:transition-[width] after:duration-200 after:ease-out",
              done ? 'after:w-full' : 'after:w-0',
            )}
          >
            {todo.title}
          </span>
          {todo.flagged && (
            <Flag className="size-3 shrink-0 text-orange" aria-hidden />
          )}
        </button>

        <RowTrail todo={todo} tags={tags} />

        {todo.notes && (
          <FileText className="size-3 shrink-0 text-label-tertiary" aria-hidden />
        )}
      </div>

      {expanded && detail && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={tween}
          // Detail editor swallows clicks so they don't re-trigger selection.
          data-todo-stop
          onMouseDown={(e) => e.stopPropagation()}
          className="overflow-hidden"
        >
          {detail}
        </motion.div>
      )}
      <div
        ref={belowBand.ref}
        data-testid={`drop-below-${todo.id}`}
        data-drop-active={belowBand.isActive ? 'true' : undefined}
        aria-hidden
        className="pointer-events-none absolute -bottom-1 -left-1 -right-1 h-1.5"
      >
        {belowBand.isActive && (
          <span className="absolute top-1/2 left-0 right-0 h-px bg-tint" />
        )}
      </div>
    </div>
  );
});

/**
 * Trailing meta cluster: deadline badge → date pill → repeat indicator. Each
 * piece is gated on its underlying `Todo` field so empty rows stay clean.
 * Layout order matches Things3: deadline severity leads (red flag = highest
 * priority signal), then the scheduled-date pill, then the repeat glyph as a
 * subdued marker. Colours come from `scheduleLabel.ts` so the source of truth
 * for "Today/Tomorrow/overdue" lives in one place.
 */
function RowTrail({ todo, tags }: { todo: Todo; tags: Tag[] }) {
  const pill = deriveSchedulePill(todo);
  const deadline = deriveDeadline(todo);
  const recurrence = todo.recurrence;
  const dueLabel =
    typeof todo.dueDate === 'number' ? formatDueShort(todo.dueDate) : null;

  // Resolve tag-ids → Tag in the store's display order. Cap at 3 chips; any
  // surplus becomes a `+N` plain-text counter so the trail width stays bounded.
  const ids = todo.tagIds ?? [];
  const idSet = new Set(ids);
  const visibleTags = ids.length === 0 ? [] : tags.filter((t) => idSet.has(t.id));
  const shownTags = visibleTags.slice(0, 3);
  const overflow = visibleTags.length - shownTags.length;

  if (!pill && !deadline && !recurrence && shownTags.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {shownTags.map((t) => (
        <TagChip key={t.id} tag={t} />
      ))}
      {overflow > 0 && (
        <span
          data-testid="tag-overflow"
          className="text-footnote text-label-tertiary tabular-nums"
        >
          +{overflow}
        </span>
      )}
      {deadline === 'overdue' && dueLabel && (
        <span
          className="inline-flex items-center gap-0.5 text-footnote text-red tabular-nums"
          aria-label={`Overdue ${dueLabel}`}
          title={`Overdue ${dueLabel}`}
          data-deadline="overdue"
        >
          <Flag className="size-3" fill="currentColor" aria-hidden />
          <span>{dueLabel}</span>
        </span>
      )}
      {deadline === 'today' && dueLabel && (
        <span
          className="inline-flex items-center gap-0.5 text-footnote text-orange tabular-nums"
          aria-label={`Due ${dueLabel}`}
          title={`Due ${dueLabel}`}
          data-deadline="today"
        >
          <Flag className="size-3" aria-hidden />
          <span>{dueLabel}</span>
        </span>
      )}
      {pill && (
        <span
          data-schedule={pill.kind}
          className={cn('text-footnote tabular-nums', pill.tint)}
        >
          {pill.label}
        </span>
      )}
      {recurrence && (
        <span
          title={summarizeRecurrence(recurrence)}
          aria-label={`Repeats: ${summarizeRecurrence(recurrence)}`}
          data-repeat="true"
          className="inline-flex"
        >
          <RotateCw className="size-3 text-label-tertiary" aria-hidden />
        </span>
      )}
    </div>
  );
}

/** Animated check glyph. When `animate` is true, the path is drawn from 0 →
 *  full over 180ms via motion's `pathLength` driver. Otherwise it renders
 *  in its final state (used on initial mount when the todo is already done). */
function CheckGlyph({
  animate,
  className,
}: {
  animate: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <motion.path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 8.5l3 3 6-7"
        initial={animate ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.check, ease: easeOut }}
      />
    </svg>
  );
}
