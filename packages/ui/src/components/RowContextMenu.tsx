import {
  ArrowRight,
  CalendarClock,
  CheckSquare,
  Flag,
  Repeat,
  Sun,
  Trash2,
} from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

export type RowContextAction =
  | 'complete'
  | 'flag'
  | 'schedule'
  | 'move'
  | 'when'
  | 'repeat'
  | 'delete';

/**
 * Wraps `ContextMenu` with the canonical Things3 row-action set. The action
 * names match the per-row context menu in Things; placeholders that aren't
 * wired yet (`schedule`, `move`, `when`, `repeat`) still emit a
 * callback so the parent can route them to Wave 2 work.
 *
 * When the row that triggered the menu is part of a multi-select, the parent
 * is expected to forward the action to every selected row. The menu itself
 * is selection-agnostic; it just emits the action label.
 */
export function RowContextMenu({
  x,
  y,
  selectionCount = 1,
  alreadyDone = false,
  alreadyFlagged = false,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  selectionCount?: number;
  alreadyDone?: boolean;
  alreadyFlagged?: boolean;
  onAction(action: RowContextAction): void;
  onClose(): void;
}) {
  const plural = selectionCount > 1 ? ` ${selectionCount} to-dos` : '';
  const items: ContextMenuItem[] = [
    {
      label: alreadyDone ? `Mark${plural} as not done` : `Complete${plural}`,
      icon: <CheckSquare className="size-3.5" />,
      onSelect: () => onAction('complete'),
    },
    {
      label: alreadyFlagged ? `Unflag${plural}` : `Flag${plural}`,
      icon: <Flag className="size-3.5" />,
      onSelect: () => onAction('flag'),
    },
    {
      label: 'When…',
      icon: <Sun className="size-3.5" />,
      onSelect: () => onAction('when'),
    },
    {
      label: 'Schedule…',
      icon: <CalendarClock className="size-3.5" />,
      onSelect: () => onAction('schedule'),
    },
    {
      label: 'Move to…',
      icon: <ArrowRight className="size-3.5" />,
      onSelect: () => onAction('move'),
    },
    {
      label: 'Repeat…',
      icon: <Repeat className="size-3.5" />,
      onSelect: () => onAction('repeat'),
    },
    {
      label: `Delete${plural}`,
      icon: <Trash2 className="size-3.5" />,
      destructive: true,
      onSelect: () => onAction('delete'),
    },
  ];
  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
}
