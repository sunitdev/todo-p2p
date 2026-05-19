import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PaletteColor } from '@todo-p2p/core';
import { cn } from '../lib/cn';
import { COLOR_TEXT, COLOR_BG } from '../lib/palette';

/**
 * Things3 project progress ring.
 *
 * Design: Things3 hallmark — a circular arc around the project icon that fills
 * as todos complete. Used in the sidebar (size=sm) and page header (size=md).
 *
 * Implementation note (CSP): The production CSP is `style-src 'self'`, which
 * blocks both `style={{}}` and inline `<style>` blocks. That rules out
 * pushing a dynamic CSS custom property (`--progress: 0.42`) through React.
 *
 * Two CSP-safe paths remained:
 *  (a) Bucket progress into a fixed set of Tailwind classes (e.g. 21 steps at
 *      5% each), losing the continuous Things3 animation.
 *  (b) Use a structural `<svg>` whose arc is driven by the `stroke-dashoffset`
 *      attribute — an SVG presentation attribute, not a style, so CSP allows
 *      it. CSS transitions on `stroke-dashoffset` are declared via a class in
 *      the stylesheet, so the animation is also CSP-safe.
 *
 * Picked (b). The design rule "no inline SVG" means "do not hand-roll icon
 * SVGs in place of lucide-react"; a structural progress ring is in the same
 * category as the existing inline checkmark glyph in `Home.tsx`'s TodoRow.
 *
 * `prefers-reduced-motion` is honoured by the global rule in `styles.css`
 * which forces `transition-duration: 0ms` on all elements when reduce is set.
 */

export type ProgressIconSize = 'sm' | 'md' | 'lg';

export type ProgressIconInner =
  | { kind: 'emoji'; value: string }
  | { kind: 'icon'; lucide: LucideIcon }
  | { kind: 'dot' };

export interface ProgressIconProps {
  /** 0..1 — values outside are clamped. */
  progress: number;
  /** sm=16px (sidebar), md=24px (page header), lg=32px (large header). */
  size?: ProgressIconSize;
  color: PaletteColor;
  inner: ProgressIconInner;
  /** When the surrounding row is selected, tint the ring + inner white. */
  active?: boolean;
}

interface SizeSpec {
  /** Outer box edge in px. */
  box: number;
  /** Stroke thickness in px. */
  stroke: number;
  /** Tailwind size-N class for outer box. */
  boxClass: string;
  /** Tailwind text-size class for emoji inner. */
  emojiClass: string;
  /** Tailwind size-N class for lucide inner. */
  iconClass: string;
  /** Tailwind size-N class for the dot inner. */
  dotClass: string;
}

const SIZE_SPEC: Record<ProgressIconSize, SizeSpec> = {
  sm: {
    box: 16,
    stroke: 1.5,
    boxClass: 'size-4',
    emojiClass: 'text-[10px]',
    iconClass: 'size-2.5',
    dotClass: 'size-1',
  },
  md: {
    box: 24,
    stroke: 2,
    boxClass: 'size-6',
    emojiClass: 'text-[14px]',
    iconClass: 'size-3.5',
    dotClass: 'size-1.5',
  },
  lg: {
    box: 32,
    stroke: 2.5,
    boxClass: 'size-8',
    emojiClass: 'text-[18px]',
    iconClass: 'size-5',
    dotClass: 'size-2',
  },
};

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

export function ProgressIcon({
  progress,
  size = 'sm',
  color,
  inner,
  active,
}: ProgressIconProps) {
  const spec = SIZE_SPEC[size];
  const target = clamp01(progress);

  // Start at 0 on first mount, then drive to the target value next frame so
  // the CSS transition on `stroke-dashoffset` plays the Things3 fill-in even
  // for a fully-pre-filled ring on initial appearance.
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDisplayed(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  // Geometry in a unit 100x100 viewBox; inset by half-stroke so the stroke
  // stays inside the box. Stroke width is given as a fraction of the viewBox.
  const halfStroke = (spec.stroke / spec.box) * 50;
  const r = 50 - halfStroke;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - displayed);
  const strokeViewbox = (spec.stroke / spec.box) * 100;

  const completed = target >= 1;
  const ringColorClass = active ? 'text-white' : COLOR_TEXT[color];
  const trackColorClass = active ? 'text-white/30' : 'text-label-quaternary';

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        spec.boxClass,
      )}
      role="img"
      aria-label={`Progress ${Math.round(target * 100)}%`}
      data-progress={Math.round(target * 100)}
    >
      <svg
        viewBox="0 0 100 100"
        className={cn('absolute inset-0', spec.boxClass)}
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeViewbox}
          className={trackColorClass}
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeViewbox}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className={cn('progress-ring', ringColorClass)}
        />
      </svg>

      <InnerContent
        inner={inner}
        spec={spec}
        color={color}
        completed={completed}
        active={active}
      />
    </span>
  );
}

function InnerContent({
  inner,
  spec,
  color,
  completed,
  active,
}: {
  inner: ProgressIconInner;
  spec: SizeSpec;
  color: PaletteColor;
  completed: boolean;
  active: boolean | undefined;
}) {
  if (inner.kind === 'emoji') {
    return (
      <span
        className={cn(
          'relative inline-flex items-center justify-center leading-none',
          spec.emojiClass,
        )}
      >
        {inner.value}
      </span>
    );
  }
  if (inner.kind === 'icon') {
    const Icon = inner.lucide;
    return (
      <Icon
        className={cn(
          'relative shrink-0',
          spec.iconClass,
          active ? 'text-white' : COLOR_TEXT[color],
        )}
        aria-hidden
      />
    );
  }
  // dot — center dot. Fills with the project color when completed for a
  // subtle "done" state that mirrors Things3's solid-tick treatment.
  return (
    <span
      className={cn(
        'relative inline-block shrink-0 rounded-full',
        spec.dotClass,
        completed ? (active ? 'bg-white' : COLOR_BG[color]) : 'bg-transparent',
      )}
      data-completed={completed ? 'true' : 'false'}
    />
  );
}
