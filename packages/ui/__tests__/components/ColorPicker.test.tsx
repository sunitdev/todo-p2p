import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PALETTE_COLORS } from '@todo-p2p/core';
import { ColorPicker } from '../../src/components/ColorPicker';

afterEach(cleanup);

describe('ColorPicker', () => {
  test('renders a radiogroup with one radio per palette color', () => {
    render(<ColorPicker value="tint" onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Color' });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(PALETTE_COLORS.length);
  });

  test('current value is aria-checked, others are not', () => {
    render(<ColorPicker value="indigo" onChange={() => {}} />);
    const checked = screen.getByRole('radio', { name: 'Indigo' });
    expect(checked.getAttribute('aria-checked')).toBe('true');
    const other = screen.getByRole('radio', { name: 'Red' });
    expect(other.getAttribute('aria-checked')).toBe('false');
  });

  test('clicking a radio emits onChange with that color', () => {
    const onChange = mock();
    render(<ColorPicker value="tint" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Green' }));
    expect(onChange).toHaveBeenCalledWith('green');
  });
});
