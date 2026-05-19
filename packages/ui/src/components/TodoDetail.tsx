import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { CalendarDays, Flag, Trash2 } from 'lucide-react';
import type { Todo } from '@todo-p2p/core';
import { cn } from '../lib/cn';

/**
 * Inline detail editor for a single todo (Things3 expands the row in place
 * rather than opening a modal). Mounts inside `TodoRow`'s expansion region
 * and edits via `onPatch`; the parent owns persistence (`store.updateTodo`).
 *
 * Esc and clicks outside the card collapse the editor via `onClose`. The
 * pickers for When / Repeat are placeholder buttons until the date system
 * lands in Wave 2.
 */
export function TodoDetail({
  todo,
  onPatch,
  onDelete,
  onClose,
  onOpenWhen,
}: {
  todo: Todo;
  onPatch(patch: Partial<Pick<Todo, 'title' | 'notes' | 'flagged'>>): void;
  onDelete(): void;
  onClose(): void;
  onOpenWhen?(): void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? '');
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  useEffect(() => {
    const onDown = (e: globalThis.MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) {
        commitAndClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function flush() {
    const trimmedTitle = title.trim();
    const trimmedNotes = notes.trim();
    if (trimmedTitle && trimmedTitle !== todo.title) {
      onPatch({ title: trimmedTitle });
    }
    if (trimmedNotes !== (todo.notes ?? '')) {
      onPatch({ notes: trimmedNotes });
    }
  }

  function commitAndClose() {
    flush();
    onClose();
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      commitAndClose();
    }
  };

  return (
    <div
      ref={cardRef}
      role="region"
      aria-label="Edit to-do"
      onKeyDown={onKeyDown}
      className="ml-6 mr-1 mb-1 mt-0.5 rounded-2 bg-bg-l1 px-3 py-2 shadow-ambient"
    >
      <input
        ref={titleRef}
        aria-label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="block w-full bg-transparent text-callout font-medium text-label focus:outline-none"
      />
      <textarea
        aria-label="Notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        className="mt-1.5 block w-full resize-none bg-transparent text-footnote text-label placeholder:text-label-tertiary focus:outline-none"
      />

      <div className="mt-2 flex items-center gap-1 border-t border-separator/60 pt-2">
        <MetaBtn icon={<CalendarDays className="size-3.5" />} label="When" onClick={onOpenWhen} />
        <button
          type="button"
          aria-label="Flag"
          aria-pressed={!!todo.flagged}
          onClick={() => onPatch({ flagged: !todo.flagged })}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-2 px-2 text-footnote transition-colors',
            todo.flagged
              ? 'text-orange'
              : 'text-label-secondary hover:bg-bg-l3 hover:text-label',
          )}
        >
          <Flag className="size-3.5" />
          <span>{todo.flagged ? 'Flagged' : 'Flag'}</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-7 items-center gap-1 rounded-2 px-2 text-footnote text-red hover:bg-red/10"
          >
            <Trash2 className="size-3.5" />
            <span>Delete</span>
          </button>
          <button
            type="button"
            onClick={commitAndClose}
            className="inline-flex h-7 items-center rounded-2 bg-tint px-3 text-footnote font-medium text-white hover:opacity-90"
          >
            Done editing
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-2 px-2 text-footnote text-label-secondary transition-colors hover:bg-bg-l3 hover:text-label"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
