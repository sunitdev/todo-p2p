import { AlertTriangle } from 'lucide-react';

/**
 * Unsupported browser screen — terminal state when WebTransport is missing
 * (e.g. Safari). Per CLAUDE.md: no silent fallback.
 */
export interface UnsupportedProps {
  /**
   * Download URL for the desktop app.
   * TODO P9.3: replace placeholder `#download` with the real release page.
   */
  downloadUrl?: string;
}

export function Unsupported({ downloadUrl = '#download' }: UnsupportedProps) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-l2 px-6 text-center">
      <div className="flex max-w-prose flex-col items-center gap-3">
        <AlertTriangle
          className="size-12 text-label-secondary"
          aria-hidden
        />
        <h1 className="text-title font-bold text-label">Browser not supported</h1>
        <p className="text-callout text-label-secondary">
          This browser lacks WebTransport. Use Chrome, Edge, or download the desktop app.
        </p>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex h-8 items-center rounded-full bg-tint px-4 text-callout font-medium text-white hover:opacity-90"
        >
          Get desktop app
        </a>
      </div>
    </div>
  );
}
