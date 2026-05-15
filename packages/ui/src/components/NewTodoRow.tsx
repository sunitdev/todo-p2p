import { useEffect, useRef, useState } from 'react';
import { Flag, ListChecks, Tag, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

export type ScheduleHint = {
  label: string;
  icon: LucideIcon;
  tint: string;
  fill?: boolean;
};

export type NewTodoDraft = {
  title: string;
  notes?: string;
  flagged?: boolean;
};

export function NewTodoRow({
  scheduleHint,
  onCommit,
  onCancel,
  onBlurEmpty,
}: {
  scheduleHint: ScheduleHint;
  onCommit(draft: NewTodoDraft): void;
  onCancel(): void;
  onBlurEmpty(): void;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [flagged, setFlagged] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    const trimmed = title.trim();
    if (!trimmed) {
      onBlurEmpty();
      return;
    }
    committedRef.current = true;
    const draft: NewTodoDraft = { title: trimmed };
    const trimmedNotes = notes.trim();
    if (trimmedNotes) draft.notes = trimmedNotes;
    if (flagged) draft.flagged = true;
    onCommit(draft);
  };

  const handleCardBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && cardRef.current?.contains(next)) return;
    commit();
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      committedRef.current = true; // prevent commit on the subsequent blur
      onCancel();
    }
  };

  return (
    <li className="my-0.5 list-none">
      <div
        ref={cardRef}
        onBlur={handleCardBlur}
        className="rounded-2 border border-separator bg-bg-l1 shadow-ambient"
      >
        <div className="flex items-center gap-2 px-3 pt-2">
          <span
            aria-hidden
            className="inline-flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border border-label-tertiary"
          />
          <input
            ref={titleRef}
            type="text"
            aria-label="New to-do title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else {
                handleEscape(e);
              }
            }}
            placeholder="New To-Do"
            className="flex-1 bg-transparent text-body text-label placeholder:text-label-tertiary focus:outline-none"
          />
        </div>

        <div className="px-3 pb-2 pl-[34px]">
          <textarea
            aria-label="Notes"
            rows={1}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={handleEscape}
            placeholder="Notes"
            className="block w-full resize-none bg-transparent text-callout text-label placeholder:text-label-tertiary focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between border-t border-separator px-2 py-1.5">
          <SchedulePill hint={scheduleHint} />
          <div className="flex items-center gap-0.5">
            <IconBtn icon={Tag} label="Tag" />
            <IconBtn icon={ListChecks} label="Checklist" disabled />
            <IconBtn
              icon={Flag}
              label="Flag"
              pressed={flagged}
              onClick={() => setFlagged((v) => !v)}
              activeClassName="text-orange"
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function SchedulePill({ hint }: { hint: ScheduleHint }) {
  const Icon = hint.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-footnote">
      <Icon
        className={cn('size-3.5 shrink-0', hint.tint)}
        fill={hint.fill ? 'currentColor' : 'none'}
      />
      <span className="font-medium text-label">{hint.label}</span>
    </span>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  pressed,
  activeClassName,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-2 transition-colors',
        disabled
          ? 'text-label-tertiary opacity-40'
          : 'text-label-secondary hover:bg-bg-l3 hover:text-label',
        pressed && activeClassName,
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
