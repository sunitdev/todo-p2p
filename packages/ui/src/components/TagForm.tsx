import { useState } from 'react';
import type { PaletteColor, Tag } from '@todo-p2p/core';
import { Modal } from './Modal';
import { ColorPicker } from './ColorPicker';

export interface TagFormResult {
  name: string;
  color: PaletteColor;
}

export function TagForm({
  initial,
  title,
  submitLabel,
  onClose,
  onSubmit,
}: {
  initial?: Pick<Tag, 'name' | 'color'>;
  title: string;
  submitLabel: string;
  onClose(): void;
  onSubmit(result: TagFormResult): void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<PaletteColor>(initial?.color ?? 'tint');

  const canSubmit = name.trim().length > 0;

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-2 px-3 py-1.5 text-callout text-label-secondary hover:bg-label/5"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit({ name: name.trim(), color })}
            className="rounded-2 bg-tint px-3 py-1.5 text-callout font-medium text-white disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Name">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Errand, Focus…"
            className="w-full rounded-2 bg-label/5 px-3 py-2 text-body text-label outline-none placeholder:text-label-tertiary focus:bg-label/8"
          />
        </Field>
        <Field label="Color">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-footnote font-medium text-label-secondary">{label}</div>
      {children}
    </div>
  );
}
