import { useState, type FormEvent } from 'react';

/**
 * Passphrase prompt for encrypted backup export/import (M3 / P9.5). Kept in
 * `apps/web` (not `packages/ui`) because it drives platform file I/O. Styled to
 * match the pairing cards in `App.tsx`. The passphrase never leaves this process
 * except as PBKDF2 input inside the backup codec.
 */
export interface BackupDialogProps {
  title: string;
  description: string;
  submitLabel: string;
  /** Export needs a confirmation field; import (verifying an existing file) does not. */
  requireConfirm: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (passphrase: string) => void;
  onClose: () => void;
}

export function BackupDialog({
  title,
  description,
  submitLabel,
  requireConfirm,
  busy,
  error,
  onSubmit,
  onClose,
}: BackupDialogProps) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');

  const mismatch = requireConfirm && confirm.length > 0 && pass !== confirm;
  const canSubmit = pass.length > 0 && !busy && (!requireConfirm || pass === confirm);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) onSubmit(pass);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-label/30 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-[460px] max-w-[92vw] rounded-4 border border-separator bg-bg-l1 p-6 shadow-ambient"
      >
        <h1 className="text-title font-bold text-label">{title}</h1>
        <p className="mt-1 text-callout text-label-secondary">{description}</p>

        <label className="mt-5 block text-footnote text-label-secondary" htmlFor="backup-pass">
          Passphrase
        </label>
        <input
          id="backup-pass"
          type="password"
          autoFocus
          value={pass}
          disabled={busy}
          onChange={(e) => setPass(e.target.value)}
          className="mt-1 h-9 w-full rounded-2 border border-separator bg-bg-l2 px-3 text-body text-label outline-none focus:border-tint disabled:opacity-40"
        />

        {requireConfirm && (
          <>
            <label
              className="mt-3 block text-footnote text-label-secondary"
              htmlFor="backup-confirm"
            >
              Confirm passphrase
            </label>
            <input
              id="backup-confirm"
              type="password"
              value={confirm}
              disabled={busy}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 h-9 w-full rounded-2 border border-separator bg-bg-l2 px-3 text-body text-label outline-none focus:border-tint disabled:opacity-40"
            />
          </>
        )}

        {requireConfirm && (
          <p className="mt-3 text-footnote text-label-tertiary">
            There is no recovery. If you lose this passphrase, the backup cannot be opened.
          </p>
        )}

        {mismatch && <p className="mt-3 text-footnote text-red">Passphrases do not match.</p>}
        {error && <p className="mt-3 text-footnote text-red">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-full border border-separator px-4 text-callout text-label hover:bg-bg-l3 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-8 items-center rounded-full bg-tint px-4 text-callout font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Working…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
