import { useEffect, useState } from 'react';
import type { Transition } from 'motion/react';

export const easeOut: [number, number, number, number] = [0.2, 0, 0, 1];

export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  check: 0.18,
  rowOut: 0.2,
  rowHold: 0.5,
} as const;

export const tween: Transition = { duration: duration.base, ease: easeOut };
export const tweenFast: Transition = { duration: duration.fast, ease: easeOut };
export const tweenSlow: Transition = { duration: duration.slow, ease: easeOut };

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
