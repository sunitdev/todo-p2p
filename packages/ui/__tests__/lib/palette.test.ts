import { describe, expect, test } from 'bun:test';
import { PALETTE_COLORS } from '@todo-p2p/core';
import {
  COLOR_BG,
  COLOR_BORDER,
  COLOR_LABEL,
  COLOR_RING,
  COLOR_TEXT,
} from '../../src/lib/palette';

describe('palette maps', () => {
  test('every palette color has entries in every map', () => {
    for (const color of PALETTE_COLORS) {
      expect(COLOR_TEXT[color]).toBeTruthy();
      expect(COLOR_BG[color]).toBeTruthy();
      expect(COLOR_RING[color]).toBeTruthy();
      expect(COLOR_BORDER[color]).toBeTruthy();
      expect(COLOR_LABEL[color]).toBeTruthy();
    }
  });

  test('text/bg/ring/border classes use the same suffix', () => {
    for (const c of PALETTE_COLORS) {
      expect(COLOR_TEXT[c]).toBe(`text-${c}`);
      expect(COLOR_BG[c]).toBe(`bg-${c}`);
      expect(COLOR_RING[c]).toBe(`ring-${c}`);
      expect(COLOR_BORDER[c]).toBe(`border-${c}`);
    }
  });
});
