import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import type { Heading } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

export interface HeadingRowProps {
  heading: Heading;
  /** Persist a rename. Caller wires this to `store.updateHeading(id, { title })`. */
  onRename(title: string): void;
  /** Remove the heading. Caller wires this to `store.removeHeading(id)`. */
  onDelete(): void;
}

/**
 * Project-scoped section header. Things3-style: 15px bold title with a 1px
 * underline. Right-click opens a Rename/Delete menu; Rename swaps the title
 * for an inline `<input>` (Enter saves, Esc cancels). Drag-to-reorder is a
 * Wave 3+ follow-up (see TODO below).
 *
 * TODO: drag-to-reorder headings (Wave 3+)
 */
export function HeadingRow({ heading, onRename, onDelete }: HeadingRowProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(heading.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the draft whenever the underlying heading title changes externally
  // (e.g. remote sync) so the next rename starts from truth.
  useEffect(() => {
    if (!editing) setDraft(heading.title);
  }, [heading.title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = useCallback(() => {
    setDraft(heading.title);
    setEditing(true);
  }, [heading.title]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(heading.title);
  }, [heading.title]);

  const commitEdit = useCallback(() => {
    const next = draft.trim();
    if (next.length === 0 || next === heading.title) {
      cancelEdit();
      return;
    }
    setEditing(false);
    onRename(next);
  }, [draft, heading.title, onRename, cancelEdit]);

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const items: ContextMenuItem[] = [
    { label: 'Rename', onSelect: startEdit },
    { label: 'Delete', destructive: true, onSelect: onDelete },
  ];

  return (
    <>
      <div
        data-testid={`heading-row-${heading.id}`}
        onContextMenu={handleContextMenu}
        className="mt-4 pb-2 border-b border-separator"
      >
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            aria-label="Heading title"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            onBlur={commitEdit}
            className={cn(
              'w-full bg-transparent text-headline font-semibold text-label',
              'outline-none border-none p-0',
            )}
          />
        ) : (
          <h2 className="text-headline font-semibold text-label">{heading.title}</h2>
        )}
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />
      )}
    </>
  );
}
