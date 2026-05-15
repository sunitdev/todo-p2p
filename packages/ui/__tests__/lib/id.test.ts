import { describe, expect, test } from 'bun:test';
import { newId } from '../../src/lib/id';

describe('newId', () => {
  test('returns 36-char UUID when crypto.randomUUID exists', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test('produces unique ids on repeated calls', () => {
    const ids = new Set(Array.from({ length: 32 }, () => newId()));
    expect(ids.size).toBe(32);
  });
});
