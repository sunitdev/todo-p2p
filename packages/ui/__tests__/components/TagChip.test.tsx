import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import type { Tag } from '@todo-p2p/core';
import { TagChip } from '../../src/components/TagChip';

afterEach(cleanup);

function tag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 't1',
    name: 'Focus',
    color: 'purple',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('TagChip', () => {
  test('renders tag name with palette text colour', () => {
    render(<TagChip tag={tag()} />);
    const chip = screen.getByText('Focus');
    expect(chip.className).toContain('text-purple');
    expect(chip.className).toContain('bg-bg-l3');
  });

  test('uses pointer-events-none so chip clicks bubble through', () => {
    render(<TagChip tag={tag({ color: 'orange' })} />);
    const chip = screen.getByText('Focus');
    expect(chip.className).toContain('pointer-events-none');
    expect(chip.className).toContain('text-orange');
  });
});
