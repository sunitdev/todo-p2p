import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/cn';
import { duration, easeOut } from '../lib/motion';

/**
 * Sidebar-row count badge. Renders nothing while the value is 0 (Things3
 * hides empty section counts). When the value changes, the new digit cross-
 * fades up while the old digit fades down, using motion's `AnimatePresence`
 * with `value`-as-key.
 */
export function SidebarCount({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  if (value <= 0) return null;
  return (
    <span
      aria-live="polite"
      data-testid="sidebar-count"
      data-value={value}
      className={cn(
        'relative inline-flex h-4 min-w-3 items-center justify-end overflow-hidden text-footnote tabular-nums',
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: duration.base, ease: easeOut }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
