import { PALETTE_COLORS, type PaletteColor } from '@todo-p2p/core';
import { COLOR_BG, COLOR_LABEL } from '../lib/palette';
import { cn } from '../lib/cn';

export function ColorPicker({
  value,
  onChange,
}: {
  value: PaletteColor;
  onChange(next: PaletteColor): void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {PALETTE_COLORS.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={c === value}
          aria-label={COLOR_LABEL[c]}
          onClick={() => onChange(c)}
          className={cn(
            'size-7 rounded-full transition-transform',
            COLOR_BG[c],
            c === value
              ? 'ring-2 ring-offset-2 ring-offset-bg-l1 ring-label scale-110'
              : 'hover:scale-105',
          )}
        />
      ))}
    </div>
  );
}
