# Components

Each: intent → props → Tailwind snippet → Do/Don't. Shared in `packages/ui/src/components/`. Flat surfaces — no glass, no blur.

## Button

Intent: primary action. 3 Things3 variants.

| Prop | Type | Default |
|------|------|---------|
| variant | `'pill' \| 'icon' \| 'plain'` | `pill` |
| size | `'sm' \| 'md'` | `sm` |
| icon | `LucideIcon` | — |
| disabled | `boolean` | `false` |

```tsx
// pill — "New List" w/ trailing label
<button className="inline-flex h-7 items-center gap-1.5 rounded-2 px-2 text-footnote font-medium text-label-secondary hover:bg-bg-l3 hover:text-label">
  <span className="inline-flex size-4 items-center justify-center rounded-full bg-tint text-white">
    <Plus className="size-2.5" />
  </span>
  <span>New List</span>
</button>

// icon — toolbar 32px round
<button className="inline-flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-bg-l3 hover:text-label">
  <Calendar className="size-4" />
</button>

// plain — destructive in modals
<button className="text-callout text-red hover:underline">Delete</button>
```

- Do: 28-32px touch. Single-fill blue only for "new" affordance.
- Don't: gradient/shadow buttons. No stacked pills.

## ListRow

Intent: scannable row. Compact ~28px, no chevron.

| Prop | Type |
|------|------|
| leading | `LucideIcon \| ReactNode` |
| title | `string` |
| trailing | `ReactNode` (count, optional) |
| active | `boolean` |
| onClick | `() => void` |

```tsx
<button
  onClick={onClick}
  className={cn(
    'group flex h-7 items-center gap-2.5 rounded-2 px-2 text-callout transition-colors',
    active ? 'row-selected' : 'text-label hover:bg-bg-l3',
  )}
>
  <Icon className={cn('size-4 shrink-0', active ? 'text-white' : iconTint)} />
  <span className="flex-1 text-left">{title}</span>
  {count > 0 && (
    <span className={cn('text-footnote tabular-nums', active ? 'text-white/80' : 'text-label-tertiary')}>
      {count}
    </span>
  )}
</button>
```

- Do: 14px text, 16px icon, 10px gap, `row-selected` for active.
- Don't: chevrons. No left accent bar — selection is row fill.

## TodoRow

Intent: single to-do. Dense canonical row.

```tsx
<li className="group flex items-center gap-2 rounded-1 px-1 py-1 hover:bg-bg-l3">
  <button
    role="checkbox"
    aria-checked={done}
    className={cn(
      'inline-flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-colors',
      done ? 'border-tint bg-tint text-white' : 'border-label-tertiary group-hover:border-label-secondary',
    )}
  >
    {done && <CheckGlyph />}
  </button>
  <div className="flex min-w-0 flex-1 flex-col">
    <span className={cn('text-body truncate', done && 'text-label-tertiary line-through')}>{title}</span>
    {notes && <p className="truncate text-footnote text-label-secondary">{notes}</p>}
  </div>
  {hasNotes && <FileText className="size-3 text-label-tertiary" />}
</li>
```

- Do: 14px square checkbox, 1px border, 3px radius. Body 13px regular.
- Don't: large circular checkboxes (iOS Reminders). No background-fill due-date pills — plain colored text.

## Sheet / Modal

```tsx
<div className="fixed inset-0 z-40 flex items-center justify-center bg-label/30">
  <div className="w-[480px] max-w-[92vw] rounded-4 border border-separator bg-bg-l1 shadow-ambient">
    {children}
  </div>
</div>
```

- Do: flat `bg-bg-l1`, 1px separator border, single ambient shadow.
- Don't: backdrop-blur, glass, multiple shadows.

## NavBar / Page header

```tsx
<header className="px-8 pt-8 pb-3">
  <div className="flex items-center gap-2.5">
    <Icon className={cn('size-6', tint)} />
    <h1 className="text-title font-bold tracking-tight text-label">{title}</h1>
  </div>
</header>
```

- Do: title 22/26 bold, icon 24px semantic tint.
- Don't: large-title collapse (Reminders pattern). No right-side action buttons — actions in bottom toolbar.

## Footer toolbar

```tsx
<footer className="border-t border-separator bg-bg-l1 px-8 py-2">
  <div className="mx-auto flex max-w-3xl items-center justify-between">
    <button aria-label="New To-Do" className="inline-flex size-8 items-center justify-center rounded-full bg-tint text-white">
      <Plus className="size-4" />
    </button>
    <div className="flex items-center gap-1">
      <ToolbarBtn icon={Calendar} label="Schedule" />
      <ToolbarBtn icon={ArrowRight} label="Move" />
      <ToolbarBtn icon={Search} label="Search" />
    </div>
  </div>
</footer>
```

- Do: leading 32px round filled-blue `+`. Trailing icons 32px round, secondary-label.
- Don't: text labels on icons. Don't pad past `py-2`.

## TextField

```tsx
<label className="flex flex-col gap-1">
  <span className="text-footnote text-label-secondary">{label}</span>
  <input className={cn(
    'h-8 px-2 rounded-2 bg-bg-l3 text-body text-label',
    'focus:outline-none focus:ring-1 focus:ring-tint',
    error && 'ring-1 ring-red'
  )} />
</label>
```

- Do: 32px tall, `bg-bg-l3` inset, 1px focus ring.
- Don't: glassy bg. No placeholder as label.

## Toggle

```tsx
<button role="switch" aria-checked={value} className={cn(
  'relative h-[20px] w-[34px] rounded-full transition-colors',
  value ? 'bg-green' : 'bg-label-quaternary'
)}>
  <span className={cn(
    'absolute top-[2px] size-[16px] rounded-full bg-white shadow-ambient transition-transform',
    value ? 'translate-x-[16px]' : 'translate-x-[2px]'
  )} />
</button>
```

- Do: macOS-sized, green when on.
- Don't: use for navigation.

## ContextMenu

```tsx
<div role="menu" className="fixed z-50 min-w-[180px] rounded-2 border border-separator bg-bg-l1 shadow-ambient py-1">
  {items.map((it) => (
    <button className="flex w-full items-center gap-2 px-3 py-1.5 text-callout text-left hover:bg-bg-l3">
      {it.icon}
      <span>{it.label}</span>
    </button>
  ))}
</div>
```

- Do: flat `bg-bg-l1` + separator border. Destructive = `text-red`.
- Don't: blur, drop-shadow stacks, glass.

## Section header (sidebar/settings)

Atom in `styles.css`:

```css
.section-header { @apply text-caption font-semibold uppercase tracking-wider text-label-tertiary; }
```

Use as `<div className="section-header ...">` for "PROJECTS"/"AREAS"/"DEVICE" labels.

## Surface (flat card)

```tsx
<div className="rounded-2 border border-separator bg-bg-l1 p-3">{children}</div>
```

- Do: pick by stack — sidebar/footer = `bg-bg-l1`; main = `bg-bg-l2`; row hover = `bg-bg-l3`.
- Don't: 3 different bg tiers in one screen. Hierarchy 2-deep max.
