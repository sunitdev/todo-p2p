import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '../lib/cn';

/**
 * Pairing screen — UI only.
 *
 * Security invariants (CLAUDE.md §pairing):
 *  - Tickets single-use, 60s expiry; UI displays a live countdown so user can
 *    see when the secret window closes.
 *  - Post-pair auth is signature based; UI never inspects or persists keys.
 *  - The fingerprint is rendered for out-of-band visual confirmation only —
 *    never logged.
 *
 * This component performs no networking and stores no secrets. The actual
 * pairing handshake lives in `packages/core` (`PairingState` reducer). The QR
 * is rendered from `payload` with the build-time-bundled `qrcode` encoder (no
 * remote/CDN) as CSP-clean SVG `<rect>`s — no canvas, no inline styles.
 */
export interface PairingProps {
  /** Serialized pairing payload to encode into the QR code. */
  payload: string;
  /** Epoch milliseconds when the ticket becomes invalid. */
  expiresAt: number;
  /** Pre-formatted short fingerprint, e.g. "a3·f9·7c". */
  fingerprint: string;
  /** User confirms remote fingerprint matches local. */
  onConfirm: () => void;
  /** Switch to scan-QR mode (camera). */
  onSwitchToScan: () => void;
  /** Regenerate ticket after expiry. */
  onRegenerate: () => void;
}

/** Quiet-zone width in modules around the QR symbol (per the QR spec). */
const QR_MARGIN = 2;

/**
 * Renders `payload` as a QR symbol of SVG rectangles. Each row's dark modules
 * are coalesced into runs to keep the DOM small. Uses presentation attributes
 * (`fill`) only — no `style=""`, so it passes the strict CSP.
 */
function QrCode({ payload }: { payload: string }) {
  const qr = useMemo(() => {
    if (!payload) return null;
    try {
      const code = QRCode.create(payload, { errorCorrectionLevel: 'M' });
      const size = code.modules.size;
      const data = code.modules.data;
      const runs: { x: number; y: number; w: number }[] = [];
      for (let y = 0; y < size; y++) {
        let x = 0;
        while (x < size) {
          if (data[y * size + x]) {
            let w = 1;
            while (x + w < size && data[y * size + x + w]) w++;
            runs.push({ x, y, w });
            x += w;
          } else {
            x++;
          }
        }
      }
      return { size, runs };
    } catch {
      return null;
    }
  }, [payload]);

  if (!qr) {
    return (
      <div
        className="flex size-[200px] items-center justify-center rounded-2 bg-bg-l3 text-center text-footnote text-label-tertiary"
        role="img"
        aria-label="Pairing QR code unavailable"
        data-payload-length={payload.length}
      >
        No pairing code
      </div>
    );
  }

  const extent = qr.size + QR_MARGIN * 2;
  return (
    <svg
      className="size-[200px] rounded-2"
      viewBox={`${-QR_MARGIN} ${-QR_MARGIN} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Pairing QR code"
      data-payload-length={payload.length}
      data-qr-size={qr.size}
    >
      <rect x={-QR_MARGIN} y={-QR_MARGIN} width={extent} height={extent} fill="#ffffff" />
      {qr.runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill="#000000" />
      ))}
    </svg>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function Pairing({
  payload,
  expiresAt,
  fingerprint,
  onConfirm,
  onSwitchToScan,
  onRegenerate,
}: PairingProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = expiresAt - now;
  const expired = remainingMs <= 0;
  const lowTime = !expired && remainingMs <= 10_000;

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-l2 px-4">
      <div className="w-[480px] max-w-[92vw] rounded-4 border border-separator bg-bg-l1 p-6 shadow-ambient">
        <h1 className="text-title font-bold text-label">Pair device</h1>

        <div className="mt-5 flex justify-center">
          <QrCode payload={payload} />
        </div>

        <p
          className={cn(
            'mt-4 text-callout tabular-nums',
            expired ? 'text-red' : lowTime ? 'text-red' : 'text-label-secondary',
          )}
          aria-live="polite"
        >
          Expires in {formatRemaining(remainingMs)}
        </p>

        <div className="mt-3 flex items-center gap-2 text-callout">
          <span className="text-label-secondary">Fingerprint:</span>
          <span className="font-mono tracking-wide text-label">{fingerprint}</span>
        </div>

        {expired && (
          <p className="mt-3 text-footnote text-red" role="alert">
            Ticket expired. Generate a new pairing code.
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          {expired ? (
            <button
              onClick={onRegenerate}
              className="inline-flex h-8 items-center rounded-full bg-tint px-4 text-callout font-medium text-white hover:opacity-90"
            >
              Generate new code
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={expired}
              className={cn(
                'inline-flex h-8 items-center rounded-full px-4 text-callout font-medium',
                'bg-tint text-white hover:opacity-90',
                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40',
              )}
            >
              Confirm match
            </button>
          )}
          <button
            onClick={onSwitchToScan}
            className="text-callout text-tint hover:underline"
          >
            Scan QR instead
          </button>
        </div>
      </div>
    </div>
  );
}
