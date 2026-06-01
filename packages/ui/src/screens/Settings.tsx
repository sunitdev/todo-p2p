import { Settings as SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Settings screen — iOS-style grouped list on flat dark surfaces.
 *
 * Security/privacy invariants (CLAUDE.md):
 *  - "Wipe device" is destructive + irreversible; requires explicit confirm.
 *  - "Export backup" produces a user-managed encrypted snapshot; never
 *    auto-uploads.
 *  - "View source" must not punch through the Tauri allowlist. Web uses a
 *    plain anchor with noopener/noreferrer. Desktop should route via a
 *    user-approved dialog; for now it's a noop with a TODO.
 */
export interface SettingsProps {
  device: { name: string; id: string };
  pairedCount: number;
  /** Number of trusted peers currently attempting to reconnect (M4 E4.3). */
  reconnecting?: number;
  version: string;
  onPairNew: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onWipeDevice: () => void;
  /**
   * Optional source URL. When provided, "View source" renders as an anchor
   * (web target). When omitted, renders as a disabled placeholder so the
   * desktop target does not require shell/http allowlist.
   * TODO P9.2: route desktop "View source" through approved Tauri command.
   */
  sourceUrl?: string;
}

export function Settings({
  device,
  pairedCount,
  reconnecting = 0,
  version,
  onPairNew,
  onExportBackup,
  onImportBackup,
  onWipeDevice,
  sourceUrl,
}: SettingsProps) {
  const handleWipe = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Wipe device data? This deletes all local to-dos, projects, and pairings. There is no recovery.',
      )
    ) {
      return;
    }
    onWipeDevice();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-bg-l2 text-label">
      <header className="px-8 pt-8 pb-3">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="size-6 text-label-secondary" />
            <h1 className="text-title font-bold tracking-tight text-label">Settings</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 pb-12 pt-2">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <Section label="Device">
            <Row title="Name" trailing={device.name} />
            <Row title="ID" trailing={<span className="font-mono">{device.id}</span>} />
          </Section>

          <Section label="Sync">
            <Row
              title="Paired devices"
              trailing={<span className="tabular-nums">{pairedCount}</span>}
            />
            {reconnecting > 0 && (
              <Row
                title="Reconnecting…"
                trailing={
                  <span className="tabular-nums text-label-tertiary">{reconnecting}</span>
                }
              />
            )}
            <Row title="Pair new…" onClick={onPairNew} />
          </Section>

          <Section label="Storage">
            <Row title="Export backup" onClick={onExportBackup} />
            <Row title="Import backup" onClick={onImportBackup} />
            <Row title="Wipe device" onClick={handleWipe} destructive />
          </Section>

          <Section label="About">
            <Row title="Version" trailing={<span className="tabular-nums">{version}</span>} />
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 items-center justify-between border-b border-separator/40 px-3 text-body text-label last:border-b-0 hover:bg-bg-l3"
              >
                <span>View source</span>
                <span className="text-footnote text-label-tertiary">Opens in browser</span>
              </a>
            ) : (
              <Row
                title="View source"
                trailing={<span className="text-label-tertiary">unavailable</span>}
              />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="section-header px-3 pb-1.5">{label}</div>
      <div className="rounded-2 border border-separator bg-bg-l1">{children}</div>
    </section>
  );
}

function Row({
  title,
  trailing,
  onClick,
  destructive,
}: {
  title: string;
  trailing?: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const base =
    'flex h-8 items-center justify-between border-b border-separator/40 px-3 text-body last:border-b-0';
  const tint = destructive ? 'text-red' : 'text-label';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, tint, 'w-full text-left hover:bg-bg-l3')}
      >
        <span>{title}</span>
        {trailing !== undefined && (
          <span className="text-label-secondary">{trailing}</span>
        )}
      </button>
    );
  }

  return (
    <div className={cn(base, tint)}>
      <span>{title}</span>
      {trailing !== undefined && (
        <span className="text-label-secondary">{trailing}</span>
      )}
    </div>
  );
}
