import type { Tag } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { COLOR_TEXT } from '../lib/palette';

/**
 * Subtle tinted chip rendered in `TodoRow`'s trail. Things3 keeps chips
 * low-saturation: `bg-bg-l3` carries the surface, the palette colour drives
 * the text. `pointer-events-none` so chip clicks bubble through to the
 * row's selection/open handlers (chips are not interactive yet).
 */
export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      data-testid={`tag-chip-${tag.id}`}
      className={cn(
        'pointer-events-none inline-flex items-center gap-1 rounded-full bg-bg-l3 px-1.5 text-footnote tabular-nums',
        COLOR_TEXT[tag.color],
      )}
    >
      {tag.name}
    </span>
  );
}
