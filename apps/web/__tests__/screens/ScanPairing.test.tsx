import { afterEach, describe, expect, test, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScanPairing } from '../../src/screens/ScanPairing';

afterEach(cleanup);

type Reader = { decodeFromVideoDevice: (...args: unknown[]) => Promise<{ stop: () => void }> };

describe('ScanPairing', () => {
  test('surfaces a permission-denied error (no silent failure)', async () => {
    const createReader = () =>
      ({
        decodeFromVideoDevice: () =>
          Promise.reject(new DOMException('denied', 'NotAllowedError')),
      }) as unknown as Reader;

    render(<ScanPairing onScan={mock()} onCancel={mock()} createReader={createReader} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/permission denied/i);
  });

  test('calls onScan once with the decoded text', async () => {
    const onScan = mock();
    const createReader = () =>
      ({
        decodeFromVideoDevice: (_id: unknown, _video: unknown, cb: (r: unknown) => void) => {
          cb({ getText: () => 'PAIRING_QR_DATA' });
          return Promise.resolve({ stop() {} });
        },
      }) as unknown as Reader;

    render(<ScanPairing onScan={onScan} onCancel={mock()} createReader={createReader} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledWith('PAIRING_QR_DATA'));
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  test('cancel button fires onCancel', () => {
    const onCancel = mock();
    const createReader = () =>
      ({ decodeFromVideoDevice: () => Promise.resolve({ stop() {} }) }) as unknown as Reader;
    render(<ScanPairing onScan={mock()} onCancel={onCancel} createReader={createReader} />);
    fireEvent.click(screen.getByRole('button', { name: /Show code instead/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
