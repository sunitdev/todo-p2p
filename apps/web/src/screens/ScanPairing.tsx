import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';

/**
 * Camera QR-scan screen (P9.8) — platform-specific, so it lives in
 * `apps/web/src/screens` (not `packages/ui`). Uses the browser camera via
 * `@zxing/browser`; `getUserMedia` needs no CSP change. On a successful decode
 * it calls `onScan(raw)` once. Permission/no-camera failures are surfaced, never
 * silent (CLAUDE.md). The scanner factory is injectable for tests.
 */
export interface ScanPairingProps {
  onScan: (raw: string) => void;
  onCancel: () => void;
  /** Test seam: override the QR reader. */
  createReader?: () => Pick<BrowserQRCodeReader, 'decodeFromVideoDevice'>;
}

export function ScanPairing({ onScan, onCancel, createReader }: ScanPairingProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = (createReader ?? (() => new BrowserQRCodeReader()))();
    let controls: IScannerControls | null = null;
    let cancelled = false;

    void (async () => {
      try {
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && !scannedRef.current) {
            scannedRef.current = true;
            onScan(result.getText());
            controls?.stop();
          }
        });
        if (cancelled) controls.stop();
      } catch (e) {
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera permission denied. Enable camera access to scan a pairing code.'
            : 'No camera available, or scanning failed. Use “Show code” on this device instead.',
        );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onScan, createReader]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-l2 px-4">
      <div className="w-[480px] max-w-[92vw] rounded-4 border border-separator bg-bg-l1 p-6 shadow-ambient">
        <h1 className="text-title font-bold text-label">Scan pairing code</h1>
        <p className="mt-1 text-callout text-label-secondary">
          Point your camera at the QR code shown on your other device.
        </p>

        <div className="mt-5 flex justify-center">
          {error ? (
            <div
              className="flex size-[240px] items-center justify-center rounded-2 bg-bg-l3 px-4 text-center text-footnote text-red"
              role="alert"
            >
              {error}
            </div>
          ) : (
            <video
              ref={videoRef}
              className="size-[240px] rounded-2 bg-black object-cover"
              aria-label="Camera preview"
              muted
              playsInline
            />
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-callout text-tint hover:underline"
          >
            Show code instead
          </button>
        </div>
      </div>
    </div>
  );
}
