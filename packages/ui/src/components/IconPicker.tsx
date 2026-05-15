import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { IconRef } from '@todo-p2p/core';
import { LUCIDE_PICKER } from '../lib/icons';
import { cn } from '../lib/cn';

const COMMON_EMOJI = [
  '⭐','🔥','💡','📚','💼','🏠','🎯','🚀','🎨','🛒',
  '🏋️','🧘','🍳','✈️','🎵','📷','💰','💳','🐶','🐱',
  '🌱','🌳','🌸','☕','🍕','🎉','🎮','📝','📅','✅',
  '❤️','✨','⚡','🌙','☀️','🧠','💪','🏆','🎓','💻',
];

export function IconPicker({
  value,
  onChange,
}: {
  value: IconRef;
  onChange(next: IconRef): void;
}) {
  const [tab, setTab] = useState<'lucide' | 'emoji'>(value.kind);
  const [query, setQuery] = useState('');

  const lucideNames = useMemo(() => Object.keys(LUCIDE_PICKER), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lucideNames;
    return lucideNames.filter((n) => n.toLowerCase().includes(q));
  }, [lucideNames, query]);

  return (
    <div>
      <div className="mb-3 inline-flex rounded-2 bg-label/5 p-0.5 text-footnote">
        <TabButton active={tab === 'lucide'} onClick={() => setTab('lucide')}>
          Lucide
        </TabButton>
        <TabButton active={tab === 'emoji'} onClick={() => setTab('emoji')}>
          Emoji
        </TabButton>
      </div>

      {tab === 'lucide' ? (
        <div>
          <label className="mb-2 flex items-center gap-2 rounded-2 bg-label/5 px-2 py-1.5">
            <Search className="size-3.5 text-label-tertiary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons"
              className="w-full bg-transparent text-footnote text-label outline-none placeholder:text-label-tertiary"
            />
          </label>
          <div className="grid max-h-[200px] grid-cols-8 gap-1 overflow-y-auto rounded-2 p-1">
            {filtered.map((name) => {
              const Icon = LUCIDE_PICKER[name]!;
              const active = value.kind === 'lucide' && value.name === name;
              return (
                <button
                  key={name}
                  onClick={() => onChange({ kind: 'lucide', name })}
                  aria-label={name}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex size-9 items-center justify-center rounded-2 transition-colors',
                    active ? 'bg-tint/15 text-tint' : 'text-label-secondary hover:bg-label/5',
                  )}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-10 gap-1 max-h-[240px] overflow-y-auto">
          {COMMON_EMOJI.map((e) => {
            const active = value.kind === 'emoji' && value.value === e;
            return (
              <button
                key={e}
                onClick={() => onChange({ kind: 'emoji', value: e })}
                aria-pressed={active}
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-2 text-[18px] leading-none transition-colors',
                  active ? 'bg-tint/15' : 'hover:bg-label/5',
                )}
              >
                {e}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-[6px] px-3 py-1 transition-colors',
        active ? 'bg-bg-l1 text-label shadow-ambient' : 'text-label-secondary hover:text-label',
      )}
    >
      {children}
    </button>
  );
}
