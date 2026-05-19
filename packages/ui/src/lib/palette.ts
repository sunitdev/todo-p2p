import type { PaletteColor } from '@todo-p2p/core';

/**
 * Static maps so Tailwind v4 sees concrete class names (no dynamic
 * `text-${color}` strings would survive content scanning).
 */
export const COLOR_TEXT: Record<PaletteColor, string> = {
  tint: 'text-tint',
  blue: 'text-blue',
  red: 'text-red',
  orange: 'text-orange',
  yellow: 'text-yellow',
  green: 'text-green',
  teal: 'text-teal',
  indigo: 'text-indigo',
  purple: 'text-purple',
  pink: 'text-pink',
  tan: 'text-tan',
  gray: 'text-gray',
};

export const COLOR_BG: Record<PaletteColor, string> = {
  tint: 'bg-tint',
  blue: 'bg-blue',
  red: 'bg-red',
  orange: 'bg-orange',
  yellow: 'bg-yellow',
  green: 'bg-green',
  teal: 'bg-teal',
  indigo: 'bg-indigo',
  purple: 'bg-purple',
  pink: 'bg-pink',
  tan: 'bg-tan',
  gray: 'bg-gray',
};

export const COLOR_RING: Record<PaletteColor, string> = {
  tint: 'ring-tint',
  blue: 'ring-blue',
  red: 'ring-red',
  orange: 'ring-orange',
  yellow: 'ring-yellow',
  green: 'ring-green',
  teal: 'ring-teal',
  indigo: 'ring-indigo',
  purple: 'ring-purple',
  pink: 'ring-pink',
  tan: 'ring-tan',
  gray: 'ring-gray',
};

export const COLOR_BORDER: Record<PaletteColor, string> = {
  tint: 'border-tint',
  blue: 'border-blue',
  red: 'border-red',
  orange: 'border-orange',
  yellow: 'border-yellow',
  green: 'border-green',
  teal: 'border-teal',
  indigo: 'border-indigo',
  purple: 'border-purple',
  pink: 'border-pink',
  tan: 'border-tan',
  gray: 'border-gray',
};

export const COLOR_LABEL: Record<PaletteColor, string> = {
  tint: 'Blue (system)',
  blue: 'Blue',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  indigo: 'Indigo',
  purple: 'Purple',
  pink: 'Pink',
  tan: 'Tan',
  gray: 'Gray',
};
