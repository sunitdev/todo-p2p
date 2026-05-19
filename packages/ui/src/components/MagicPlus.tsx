import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { cn } from '../lib/cn';
import { duration, easeOut, tween } from '../lib/motion';
import {
  useDragContextOptional,
  type DropTarget,
  type DropTargetKind,
} from '../lib/DragContext';

export interface MagicPlusDropPayload {
  kind: DropTargetKind;
  targetId: string;
}

export interface MagicPlusProps {
  /** Click handler — fires the host app's "open new draft" flow. */
  onClick(): void;
  /**
   * Called once at the end of a successful drag that landed over a registered
   * drop target. No-op drags (released over empty space) skip this entirely so
   * the host doesn't have to filter null targets.
   */
  onDrop(payload: MagicPlusDropPayload): void;
}

/**
 * Things3 "Magic Plus" — a floating, draggable round + at the bottom-right of
 * the main pane. Tap = open a new to-do at the top of the current list. Drag
 * = pick up a "new to-do" payload that can be dropped on a sidebar row or
 * between two existing rows to file the new item directly into that bucket.
 *
 * Drag mechanics use `motion`'s built-in pointer drag: we resolve the drop
 * via the shared `DragContext` (so sidebar/row consumers register their own
 * rects + highlight on hover) and `dragSnapToOrigin` snaps the button back to
 * `right-6 bottom-6` regardless of whether the drop succeeded.
 */
export function MagicPlus({ onClick, onDrop }: MagicPlusProps) {
  const ctx = useDragContextOptional();
  const [dragging, setDragging] = useState(false);
  // Suppresses the synthetic click that fires when a drag ends on top of the
  // button — without this, every drag would also re-open a draft.
  const [didDrag, setDidDrag] = useState(false);

  const updateActive = (x: number, y: number): DropTarget | null => {
    if (!ctx) return null;
    const hit = ctx.resolveAt(x, y);
    ctx.setActiveTargetId(hit?.id ?? null);
    return hit;
  };

  return (
    <motion.button
      type="button"
      aria-label="Magic Plus"
      data-testid="magic-plus"
      // Allow drag only when the DragContext is present; standalone (e.g. unit
      // tests w/o provider) the button stays a plain click target.
      drag={ctx ? true : false}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0}
      whileTap={{ scale: 0.94 }}
      whileDrag={{ scale: 1.04 }}
      transition={tween}
      onDragStart={() => {
        setDragging(true);
        setDidDrag(true);
      }}
      onDrag={(_, info) => {
        updateActive(info.point.x, info.point.y);
      }}
      onDragEnd={(_, info) => {
        const hit = updateActive(info.point.x, info.point.y);
        // Clear the highlight regardless of outcome so a no-op drop doesn't
        // leave a sticky ring on whatever the cursor crossed last.
        ctx?.setActiveTargetId(null);
        setDragging(false);
        if (hit) {
          onDrop({ kind: hit.kind, targetId: hit.id });
        }
        // Allow the next click after a brief tick — gives the synthetic click
        // event time to fire and be ignored. Stays well under any human
        // double-tap threshold.
        window.setTimeout(() => setDidDrag(false), 50);
      }}
      onClick={() => {
        if (didDrag) return;
        onClick();
      }}
      className={cn(
        'absolute right-6 bottom-6 z-20 inline-flex size-12 cursor-grab touch-none items-center justify-center rounded-full bg-tint text-white shadow-elevated',
        'transition-opacity',
        // While dragging, dim the source so the drop targets read first.
        dragging ? 'cursor-grabbing opacity-40' : 'opacity-100',
      )}
    >
      <Plus className="size-5" aria-hidden />
      {/*
        While the button itself is the drag handle, render a tiny ghost label
        next to the cursor so the user gets a Things3-style "New To-Do" pill
        readout. We position it inside the button so it travels with the
        translated motion node; it appears only mid-drag.
      */}
      {dragging && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.fast, ease: easeOut }}
          className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-footnote font-medium text-label shadow-elevated whitespace-nowrap"
          aria-hidden
        >
          <Plus className="size-3 text-tint" />
          <span>New To-Do</span>
        </motion.span>
      )}
    </motion.button>
  );
}
