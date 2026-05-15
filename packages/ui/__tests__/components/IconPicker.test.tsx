import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IconPicker } from '../../src/components/IconPicker';

afterEach(cleanup);

describe('IconPicker', () => {
  test('initial tab matches value.kind = lucide', () => {
    render(<IconPicker value={{ kind: 'lucide', name: 'Folder' }} onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Search icons')).toBeInTheDocument();
  });

  test('initial tab matches value.kind = emoji', () => {
    render(<IconPicker value={{ kind: 'emoji', value: '⭐' }} onChange={() => {}} />);
    expect(screen.queryByPlaceholderText('Search icons')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '⭐' })).toBeInTheDocument();
  });

  test('clicking a lucide icon emits onChange with shape', () => {
    const onChange = mock();
    render(<IconPicker value={{ kind: 'lucide', name: 'Folder' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rocket' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'lucide', name: 'Rocket' });
  });

  test('search filters icons case-insensitively', () => {
    render(<IconPicker value={{ kind: 'lucide', name: 'Folder' }} onChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Search icons'), { target: { value: 'roc' } });
    expect(screen.getByRole('button', { name: 'Rocket' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Folder' })).not.toBeInTheDocument();
  });

  test('switching to Emoji tab + clicking emits emoji shape', () => {
    const onChange = mock();
    render(<IconPicker value={{ kind: 'lucide', name: 'Folder' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }));
    fireEvent.click(screen.getByRole('button', { name: '🚀' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'emoji', value: '🚀' });
  });
});
