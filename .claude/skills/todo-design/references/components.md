# Components

Each: intent → props → Tailwind snippet → Do/Don't. All shared components live in `packages/ui/src/components/`.

## Button

Intent: primary action surface. 4 Apple variants.

| Prop | Type | Default |
|------|------|---------|
| variant | `'filled' \| 'tinted' \| 'plain' \| 'destructive'` | `filled` |
| size | `'sm' \| 'md' \| 'lg'` | `md` |
| icon | `LucideIcon` | — |
| loading | `boolean` | `false` |
| disabled | `boolean` | `false` |

```tsx
<button className={cn(
  'inline-flex items-center justify-center gap-2 rounded-3 px-4 min-h-[44px]',
  'text-headline font-semibold transition-transform active:scale-[0.98]',
  variant === 'filled'       && 'bg-tint text-white',
  variant === 'tinted'       && 'bg-tint/15 text-tint',
  variant === 'plain'        && 'bg-transparent text-tint',
  variant === 'destructive'  && 'bg-red text-white',
)}>{children}</button>
```

- Do: `min-h-[44px]`. Spring on press via Framer Motion or CSS scale transition.
- Don't: stack 3+ filled buttons in row. One filled max.

## ListRow

Intent: scannable row. Leading icon + title + subtitle + trailing (chevron | toggle | value).

| Prop | Type |
|------|------|
| leading | `LucideIcon \| ReactNode` |
| title | `string` |
| subtitle | `string` |
| trailing | `'chevron' \| 'toggle' \| ReactNode` |
| onPress | `() => void` |

```tsx
<button className="flex items-center w-full gap-3 px-4 min-h-[44px] text-left">
  <Icon className="size-5 text-label-secondary" />
  <span className="flex-1 text-body text-label">{title}</span>
  <ChevronRight className="size-4 text-label-tertiary" />
</button>
```

- Do: `min-h-[44px]`. Separator inset matches leading icon edge.
- Don't: more than 2 trailing elements.

## Sheet

Intent: contextual layer. Three modes: sheet (bottom), popover (anchored), alert (centered destructive). Use `<dialog>` element or Radix Dialog primitive.

```tsx
<dialog className="glass-thick rounded-t-5 p-6 backdrop:bg-black/30">{children}</dialog>
```

- Do: chrome material for nav, thick for modal, regular for picker.
- Don't: nest sheets. Use alert for confirm only.

## NavBar

Intent: title + nav actions. Large-title collapses to inline on scroll.

```tsx
<header className="sticky top-0 glass-chrome border-b border-separator px-4 py-3">
  <h1 className="text-largetitle">{title}</h1>
</header>
```

- Do: collapse threshold 40pt scroll. `glass-chrome` on collapse.
- Don't: ship large-title on modal/sheet screens.

## TextField

Intent: text input. States: idle / focus / error / disabled.

```tsx
<label className="flex flex-col gap-1">
  <span className="text-footnote text-label-secondary">{label}</span>
  <input className={cn(
    'h-11 px-3 rounded-2 bg-bg-l3 text-body text-label',
    'focus:outline-none focus:ring-2 focus:ring-tint/40',
    error && 'ring-2 ring-red/60'
  )} />
</label>
```

- Do: error replaces helper, tint=red. Focus ring = tint glow.
- Don't: placeholder as label. Label always visible.

## Toggle

Intent: binary state. Spring animated thumb.

```tsx
<button role="switch" aria-checked={value} className={cn(
  'relative h-[31px] w-[51px] rounded-full transition-colors',
  value ? 'bg-green' : 'bg-label-quaternary'
)}>
  <span className={cn(
    'absolute top-[2px] size-[27px] rounded-full bg-white shadow-ambient transition-transform',
    value ? 'translate-x-[22px]' : 'translate-x-[2px]'
  )} />
</button>
```

- Do: snappy spring. Haptic on RN.
- Don't: use for nav.

## Toast

Intent: inline non-blocking banner.

```tsx
<div role="status" className="glass-regular rounded-3 px-4 py-3 shadow-key text-body">
  {message}
</div>
```

- Do: top-anchored on web/desktop, bottom on mobile. Spring in/out.
- Don't: use toast for required action.

## Surface

Intent: glass primitive. Wrap content needing material.

```tsx
<div className="glass-regular rounded-3 shadow-ambient p-4">{children}</div>
```

Material classes: `.glass-ultra-thin`, `.glass-thin`, `.glass-regular`, `.glass-thick`, `.glass-chrome` (defined in `styles.css` `@layer components`).

- Do: pick by depth — UI chrome=`glass-chrome`, modal=`glass-thick`, card=`glass-regular`, hover=`glass-thin`, scrim=`glass-ultra-thin`.
- Don't: stack 3+ glass layers. Light gets muddy.
