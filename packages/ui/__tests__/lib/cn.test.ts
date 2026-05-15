import { describe, expect, test } from 'bun:test';
import { cn } from '../../src/lib/cn';

describe('cn', () => {
  test('joins truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  test('drops falsy values', () => {
    const flag: boolean = false;
    expect(cn('a', flag && 'b', null, undefined, 'c')).toBe('a c');
  });

  test('twMerge dedupes conflicting tailwind classes', () => {
    expect(cn('p-2 p-4')).toBe('p-4');
    expect(cn('text-red', 'text-blue')).toBe('text-blue');
  });

  test('handles array + nested arrays', () => {
    expect(cn(['a', 'b'], ['c'])).toBe('a b c');
  });
});
