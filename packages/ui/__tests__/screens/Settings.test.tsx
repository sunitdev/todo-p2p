import { afterEach, beforeEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Settings } from '../../src/screens/Settings';

afterEach(cleanup);

const baseProps = () => ({
  device: { name: 'MacBook', id: 'a3f9··' },
  pairedCount: 2,
  version: '0.1.0',
  onPairNew: mock(),
  onExportBackup: mock(),
  onImportBackup: mock(),
  onWipeDevice: mock(),
});

describe('Settings screen', () => {
  let origConfirm: typeof window.confirm;
  beforeEach(() => {
    origConfirm = window.confirm;
  });
  afterEach(() => {
    window.confirm = origConfirm;
  });

  test('renders all four sections with their labels', () => {
    render(<Settings {...baseProps()} />);
    expect(screen.getByText('Device')).toBeInTheDocument();
    expect(screen.getByText('Sync')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  test('Device section shows name and id', () => {
    render(<Settings {...baseProps()} />);
    expect(screen.getByText('MacBook')).toBeInTheDocument();
    expect(screen.getByText('a3f9··')).toBeInTheDocument();
  });

  test('Sync section shows paired count and Pair new… fires callback', () => {
    const props = baseProps();
    render(<Settings {...props} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pair new…' }));
    expect(props.onPairNew).toHaveBeenCalledTimes(1);
  });

  test('Export backup fires callback', () => {
    const props = baseProps();
    render(<Settings {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(props.onExportBackup).toHaveBeenCalledTimes(1);
  });

  test('Import backup fires callback', () => {
    const props = baseProps();
    render(<Settings {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import backup' }));
    expect(props.onImportBackup).toHaveBeenCalledTimes(1);
  });

  test('Wipe device requires confirm before firing', () => {
    const props = baseProps();
    window.confirm = mock(() => false) as unknown as typeof window.confirm;
    render(<Settings {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wipe device' }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(props.onWipeDevice).not.toHaveBeenCalled();
  });

  test('Wipe device fires when confirm accepted', () => {
    const props = baseProps();
    window.confirm = mock(() => true) as unknown as typeof window.confirm;
    render(<Settings {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wipe device' }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(props.onWipeDevice).toHaveBeenCalledTimes(1);
  });

  test('Wipe device row is styled destructive (text-red)', () => {
    render(<Settings {...baseProps()} />);
    const wipe = screen.getByRole('button', { name: 'Wipe device' });
    expect(wipe.className).toContain('text-red');
  });

  test('About shows version', () => {
    render(<Settings {...baseProps()} />);
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
  });

  test('View source renders as anchor with noopener/noreferrer when sourceUrl given', () => {
    render(
      <Settings
        {...baseProps()}
        sourceUrl="https://example.invalid/repo"
      />,
    );
    const link = screen.getByRole('link', { name: /View source/ }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.invalid/repo');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  test('View source shows unavailable when no sourceUrl (desktop default)', () => {
    render(<Settings {...baseProps()} />);
    expect(screen.queryByRole('link', { name: /View source/ })).toBeNull();
    expect(screen.getByText('unavailable')).toBeInTheDocument();
  });
});
