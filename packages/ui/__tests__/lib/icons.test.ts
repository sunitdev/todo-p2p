import { describe, expect, test } from 'bun:test';
import { Folder } from 'lucide-react';
import { LUCIDE_DEFAULT, LUCIDE_PICKER, getLucide } from '../../src/lib/icons';

describe('getLucide', () => {
  test('returns matching icon component for known name', () => {
    expect(getLucide('Folder')).toBe(Folder);
  });

  test('falls back to default Folder for unknown name', () => {
    expect(getLucide('NotAnIcon')).toBe(LUCIDE_PICKER[LUCIDE_DEFAULT]!);
  });

  test('LUCIDE_DEFAULT is present in LUCIDE_PICKER', () => {
    expect(LUCIDE_PICKER[LUCIDE_DEFAULT]).toBeDefined();
  });

  test('picker is non-empty', () => {
    expect(Object.keys(LUCIDE_PICKER).length).toBeGreaterThan(10);
  });
});
