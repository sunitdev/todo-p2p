import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { PALETTE_COLORS, type PaletteColor, type Tag } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { COLOR_BG } from '../lib/palette';

export interface TagPickerProps {
  tags: Tag[];
  value: string[];
  onChange(next: string[]): void;
  /** Create a tag and return its id so the picker can immediately toggle it on. */
  onCreateTag(input: { name: string; color: PaletteColor }): Promise<string> | string;
  onClose(): void;
  anchor: { x: number; y: number };
}

/**
 * Anchored, CSP-safe tag picker popover. Mirrors `DatePicker.tsx`:
 * - `position: fixed`, coords set via CSSOM in `useLayoutEffect`.
 * - Esc + click-outside close it.
 *
 * The "+ New Tag" footer collapses to an inline create form (name + colour
 * dots). On commit it calls `onCreateTag`, then toggles the returned id onto
 * the current todo so the chip appears in the trail without another click.
 */
export function TagPicker({
  tags,
  value,
  onChange,
  onCreateTag,
  onClose,
  anchor,
}: TagPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<PaletteColor>('tint');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, query]);

  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const commitCreate = async () => {
    const name = newName.trim();
    if (name.length === 0) return;
    const id = await Promise.resolve(onCreateTag({ name, color: newColor }));
    onChange([...value, id]);
    setNewName('');
    setNewColor('tint');
    setCreating(false);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Tags"
      data-testid="tag-picker"
      className="fixed left-0 top-0 z-50 w-[240px] rounded-2 border border-separator bg-bg-l1 p-2 shadow-elevated"
    >
      <input
        autoFocus
        type="search"
        aria-label="Search tags"
        placeholder="Search tags"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-1 w-full rounded-2 bg-label/5 px-2 py-1 text-footnote text-label outline-none placeholder:text-label-tertiary focus:bg-label/8"
      />

      <div role="listbox" aria-label="Tags" className="max-h-[240px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-2 py-1 text-footnote text-label-tertiary">
            {tags.length === 0 ? 'No tags yet' : 'No matches'}
          </div>
        ) : (
          filtered.map((t) => {
            const isSelected = selected.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(t.id)}
                className="flex h-7 w-full items-center gap-2 rounded-2 px-2 text-left text-footnote text-label transition-colors hover:bg-bg-l3"
              >
                <span className={cn('size-2 shrink-0 rounded-full', COLOR_BG[t.color])} />
                <span className="flex-1 truncate">{t.name}</span>
                {isSelected && (
                  <Check className="size-3.5 text-tint" aria-label="Selected" />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="my-1 h-px bg-separator" role="separator" />

      {creating ? (
        <div className="flex flex-col gap-1">
          <input
            autoFocus
            aria-label="New tag name"
            placeholder="Tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commitCreate();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setCreating(false);
                setNewName('');
              }
            }}
            className="w-full rounded-2 bg-label/5 px-2 py-1 text-footnote text-label outline-none placeholder:text-label-tertiary focus:bg-label/8"
          />
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Tag color">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === newColor}
                aria-label={c}
                onClick={() => setNewColor(c)}
                className={cn(
                  'size-4 rounded-full transition-transform',
                  COLOR_BG[c],
                  c === newColor && 'ring-2 ring-label ring-offset-1 ring-offset-bg-l1',
                )}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="rounded-2 px-2 py-1 text-footnote text-label-secondary hover:text-label"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={newName.trim().length === 0}
              onClick={() => void commitCreate()}
              className="rounded-2 bg-tint px-2 py-1 text-footnote font-medium text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-7 w-full items-center gap-2 rounded-2 px-2 text-left text-footnote text-label-secondary transition-colors hover:bg-bg-l3 hover:text-label"
        >
          <Plus className="size-3.5" aria-hidden />
          <span>New Tag</span>
        </button>
      )}
    </div>
  );
}
