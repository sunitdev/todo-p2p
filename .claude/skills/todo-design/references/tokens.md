# Tokens

Exact values. Drop into Tailwind v4 `@theme` in `packages/ui/src/styles.css`.

## Color — labels

| Token | Light | Dark |
|-------|-------|------|
| label | #1D1D1F | #F2F2F2 |
| label-secondary | #6E6E73 | #A1A1A6 |
| label-tertiary | #A1A1A6 | #6E6E73 |
| label-quaternary | #C7C7CC | #48484A |
| separator | #0000001A | #FFFFFF14 |

## Color — backgrounds (layered)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| bg-l1 | #F5F5F4 | #2C2C2E | sidebar, modal, footer |
| bg-l2 | #FAFAFA | #1C1C1E | main content |
| bg-l3 | #E8E8E6 | #3A3A3C | row hover, inset |

## Color — selection + tint

| Token | Light | Dark |
|-------|-------|------|
| tint | #007AFF | #0A84FF |
| row-selected | #007AFF | #0A84FF |

`row-selected` own var so selection fill can drift from `tint` (Things3 historically uses near-tint that picks up Mac accent).

## Color — semantic (sidebar + flag)

| Token | Light | Dark | Used by |
|-------|-------|------|---------|
| blue | #3478F6 | #3478F6 | Inbox |
| yellow | #F5C518 | #F5C518 | Today |
| red | #E03E3E | #E03E3E | Upcoming, due-date |
| teal | #3CB6B0 | #3CB6B0 | Anytime |
| tan | #C7A06A | #C7A06A | Someday |
| green | #3FA34D | #3FA34D | Logbook |
| orange | #FF9F0A | #FF9F0A | Flag |
| indigo/purple/pink/gray | — | — | project/area palette |

No decorative hex. Pick semantic var or extend.

## Type ramp (SF Pro, tight)

| Style | Size/Line | Weight | Use |
|-------|-----------|--------|-----|
| title | 22/26 | bold | page heading |
| headline | 15/20 | bold | group headings |
| callout | 14/18 | regular | sidebar rows, secondary buttons |
| body | 13/17 | regular | todo title default |
| footnote | 12/16 | regular | notes preview, count badges |
| caption | 11/14 | regular | tags, due-date inline |

Drop all else. Ramp = 6 steps, not 10.

## Space scale (4pt grid)

`--spacing: 4px` base. Set: `4, 6, 8, 10, 12, 16, 20, 24, 32`. Rows 28px (`h-7`). Sidebar gutter 8px (`px-2`). Main pane gutter 32px (`px-8`).

## Radius scale

`4, 8, 12, 16, 22`. Hover/select pills = `rounded-2` (8). Modals = `rounded-4` (16). Avoid `rounded-5` — Things3 never uses pill-rounded cards.

## Shadow

| Token | Offset | Blur | Color (light) | Color (dark) |
|-------|--------|------|---------------|--------------|
| ambient | 0,1 | 2 | rgba(0,0,0,0.06) | rgba(0,0,0,0.4) |

Single shadow. No `key`/`glow`.

## Motion

ease-out 150ms. `transition-colors` enough for hover. Never spring. Respect `prefers-reduced-motion`.

## Tailwind v4 `@theme` skeleton

Tokens = CSS custom props in `packages/ui/src/styles.css`. Dark flips via `prefers-color-scheme: dark`.

```css
@import "tailwindcss";

@theme {
  --color-label: #1D1D1F;
  --color-label-secondary: #6E6E73;
  --color-label-tertiary: #A1A1A6;
  --color-label-quaternary: #C7C7CC;
  --color-separator: #0000001A;

  --color-bg-l1: #F5F5F4;
  --color-bg-l2: #FAFAFA;
  --color-bg-l3: #E8E8E6;

  --color-row-selected: #007AFF;

  --color-tint: #007AFF;
  --color-blue: #3478F6;
  --color-red: #E03E3E;
  --color-orange: #FF9F0A;
  --color-yellow: #F5C518;
  --color-green: #3FA34D;
  --color-teal: #3CB6B0;
  --color-indigo: #5856D6;
  --color-purple: #AF52DE;
  --color-pink: #FF2D55;
  --color-tan: #C7A06A;
  --color-gray: #8E8E93;

  --spacing: 4px;

  --radius-1: 4px;
  --radius-2: 8px;
  --radius-3: 12px;
  --radius-4: 16px;
  --radius-5: 22px;

  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;

  --text-caption: 11px;  --text-caption--line-height: 14px;
  --text-footnote: 12px; --text-footnote--line-height: 16px;
  --text-body: 13px;     --text-body--line-height: 17px;
  --text-callout: 14px;  --text-callout--line-height: 18px;
  --text-headline: 15px; --text-headline--line-height: 20px;
  --text-title: 22px;    --text-title--line-height: 26px;

  --shadow-ambient: 0 1px 2px 0 rgba(0,0,0,0.06);
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-label: #F2F2F2;
    --color-label-secondary: #A1A1A6;
    --color-label-tertiary: #6E6E73;
    --color-label-quaternary: #48484A;
    --color-separator: #FFFFFF14;
    --color-bg-l1: #2C2C2E;
    --color-bg-l2: #1C1C1E;
    --color-bg-l3: #3A3A3C;
    --color-row-selected: #0A84FF;
    --color-tint: #0A84FF;
    --shadow-ambient: 0 1px 2px 0 rgba(0,0,0,0.4);
  }
}

@layer components {
  .row-hover { @apply hover:bg-bg-l3; }
  .row-selected { @apply bg-[var(--color-row-selected)] text-white; }
  .section-header { @apply text-caption font-semibold uppercase tracking-wider text-label-tertiary; }
}
```

No glass classes. No blur tokens. No spring tables.
