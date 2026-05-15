import { useState } from 'react';
import type { Area, IconRef, PaletteColor, Project } from '@todo-p2p/core';
import { Modal } from './Modal';
import { ColorPicker } from './ColorPicker';
import { IconPicker } from './IconPicker';
import { LUCIDE_DEFAULT, getLucide } from '../lib/icons';
import { COLOR_TEXT } from '../lib/palette';
import { cn } from '../lib/cn';

export interface ProjectFormResult {
  title: string;
  description: string;
  icon: IconRef;
  color: PaletteColor;
  areaId: string | null;
}

export function ProjectForm({
  initial,
  areas,
  title,
  submitLabel,
  defaultAreaId,
  onClose,
  onSubmit,
}: {
  initial?: Pick<Project, 'title' | 'description' | 'icon' | 'color' | 'areaId'>;
  areas: Area[];
  title: string;
  submitLabel: string;
  defaultAreaId?: string | null;
  onClose(): void;
  onSubmit(result: ProjectFormResult): void;
}) {
  const [projectTitle, setProjectTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState<IconRef>(
    initial?.icon ?? { kind: 'lucide', name: LUCIDE_DEFAULT },
  );
  const [color, setColor] = useState<PaletteColor>(initial?.color ?? 'tint');
  const [areaId, setAreaId] = useState<string | null>(
    initial?.areaId ?? defaultAreaId ?? null,
  );

  const canSubmit = projectTitle.trim().length > 0;

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
            onClick={() =>
              onSubmit({
                title: projectTitle.trim(),
                description: description.trim(),
                icon,
                color,
                areaId,
              })
            }
            className="rounded-2 bg-tint px-3 py-1.5 text-callout font-medium text-white disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <Preview icon={icon} color={color} />
          <div className="flex-1 space-y-3">
            <Field label="Title">
              <input
                autoFocus
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Launch v1, Renovate kitchen…"
                className="w-full rounded-2 bg-label/5 px-3 py-2 text-body text-label outline-none placeholder:text-label-tertiary focus:bg-label/8"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional"
                className="w-full resize-none rounded-2 bg-label/5 px-3 py-2 text-callout text-label outline-none placeholder:text-label-tertiary focus:bg-label/8"
              />
            </Field>
          </div>
        </div>

        <Field label="Icon">
          <IconPicker value={icon} onChange={setIcon} />
        </Field>

        <Field label="Color">
          <ColorPicker value={color} onChange={setColor} />
        </Field>

        <Field label="Area">
          <select
            value={areaId ?? ''}
            onChange={(e) => setAreaId(e.target.value || null)}
            className="w-full rounded-2 bg-label/5 px-3 py-2 text-callout text-label outline-none focus:bg-label/8"
          >
            <option value="">No area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
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

function Preview({ icon, color }: { icon: IconRef; color: PaletteColor }) {
  if (icon.kind === 'emoji') {
    return (
      <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-3 bg-label/5 text-[24px] leading-none">
        {icon.value}
      </div>
    );
  }
  const Icon = getLucide(icon.name);
  return (
    <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-3 bg-label/5">
      <Icon className={cn('size-6', COLOR_TEXT[color])} />
    </div>
  );
}
