# Tokens

All values exact. Drop into Tailwind v4 `@theme` block (see `tailwind-bootstrap.md`).

## Color — semantic labels

| Token | Light | Dark |
|-------|-------|------|
| label | #000000 | #FFFFFF |
| secondaryLabel | #3C3C43 99% | #EBEBF5 99% |
| tertiaryLabel | #3C3C43 4D | #EBEBF5 4D |
| quaternaryLabel | #3C3C43 2E | #EBEBF5 2E |
| separator | #3C3C43 49 | #54545899 |

Hex with alpha shown as `RRGGBB AA` (alpha hex).

## Color — backgrounds (layered)

| Token | Light | Dark |
|-------|-------|------|
| systemBackgroundL1 | #FFFFFF | #000000 |
| systemBackgroundL2 | #F2F2F7 | #1C1C1E |
| systemBackgroundL3 | #FFFFFF | #2C2C2E |

## Color — tint + semantic

| Token | Light | Dark |
|-------|-------|------|
| tint (systemBlue) | #007AFF | #0A84FF |
| red | #FF3B30 | #FF453A |
| orange | #FF9500 | #FF9F0A |
| yellow | #FFCC00 | #FFD60A |
| green | #34C759 | #30D158 |

## Glass materials

| Material | Blur(px) | Saturation | Tint light (rgba) | Tint dark (rgba) |
|----------|----------|------------|-------------------|------------------|
| ultraThin | 20 | 1.8 | rgba(255,255,255,0.45) | rgba(28,28,30,0.35) |
| thin | 30 | 1.8 | rgba(255,255,255,0.60) | rgba(28,28,30,0.50) |
| regular | 40 | 1.8 | rgba(255,255,255,0.72) | rgba(28,28,30,0.64) |
| thick | 50 | 1.8 | rgba(255,255,255,0.82) | rgba(28,28,30,0.76) |
| chrome | 60 | 2.0 | rgba(248,248,250,0.90) | rgba(36,36,38,0.86) |

## Type ramp (SF Pro)

| Style | Size/Line | Weight |
|-------|-----------|--------|
| largeTitle | 34/41 | regular |
| title1 | 28/34 | regular |
| title2 | 22/28 | regular |
| title3 | 20/25 | regular |
| headline | 17/22 | semibold |
| body | 17/22 | regular |
| callout | 16/21 | regular |
| subhead | 15/20 | regular |
| footnote | 13/18 | regular |
| caption1 | 12/16 | regular |
| caption2 | 11/13 | regular |

## Space scale (8pt grid)

`4, 8, 12, 16, 20, 24, 32, 44, 64`. 44 = HIG min touch.

## Radius scale

`4, 8, 12, 16, 22`. 22 = continuous corner (iOS app icon style).

## Shadow

| Token | Offset | Blur | Spread | Color |
|-------|--------|------|--------|-------|
| ambient | 0,1 | 2 | 0 | rgba(0,0,0,0.06) |
| key | 0,8 | 24 | -4 | rgba(0,0,0,0.12) |
| glow | 0,0 | 32 | 0 | rgba(10,132,255,0.35) |

## Motion springs

| Spring | Stiffness | Damping |
|--------|-----------|---------|
| snappy | 0.3 | 0.85 |
| smooth | 0.5 | 0.90 |
| bouncy | 0.4 | 0.60 |

## Tailwind v4 `@theme` skeleton

Tokens live as CSS custom properties in `packages/ui/src/styles.css`. Dark variants flip via `prefers-color-scheme: dark` (and optional `.dark` class) overriding the same vars.

```css
@import "tailwindcss";

@theme {
  /* color — labels */
  --color-label: #000000;
  --color-label-secondary: #3C3C43F2;
  --color-label-tertiary: #3C3C434D;
  --color-label-quaternary: #3C3C432E;
  --color-separator: #3C3C4349;

  /* color — backgrounds */
  --color-bg-l1: #FFFFFF;
  --color-bg-l2: #F2F2F7;
  --color-bg-l3: #FFFFFF;

  /* color — tint + semantic */
  --color-tint: #007AFF;
  --color-red: #FF3B30;
  --color-orange: #FF9500;
  --color-yellow: #FFCC00;
  --color-green: #34C759;

  /* spacing — 8pt grid */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-7: 32px;
  --spacing-8: 44px;
  --spacing-9: 64px;

  /* radius */
  --radius-1: 4px;
  --radius-2: 8px;
  --radius-3: 12px;
  --radius-4: 16px;
  --radius-5: 22px;

  /* font */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;

  /* type ramp (Apple) — font-size paired with line-height */
  --text-caption2: 11px; --text-caption2--line-height: 13px;
  --text-caption1: 12px; --text-caption1--line-height: 16px;
  --text-footnote: 13px; --text-footnote--line-height: 18px;
  --text-subhead: 15px;  --text-subhead--line-height: 20px;
  --text-callout: 16px;  --text-callout--line-height: 21px;
  --text-body: 17px;     --text-body--line-height: 22px;
  --text-headline: 17px; --text-headline--line-height: 22px;
  --text-title3: 20px;   --text-title3--line-height: 25px;
  --text-title2: 22px;   --text-title2--line-height: 28px;
  --text-title1: 28px;   --text-title1--line-height: 34px;
  --text-largetitle: 34px; --text-largetitle--line-height: 41px;

  /* shadows */
  --shadow-ambient: 0 1px 2px 0 rgba(0,0,0,0.06);
  --shadow-key: 0 8px 24px -4px rgba(0,0,0,0.12);
  --shadow-glow: 0 0 32px 0 rgba(10,132,255,0.35);

  /* glass blur sizes */
  --blur-ultra-thin: 20px;
  --blur-thin: 30px;
  --blur-regular: 40px;
  --blur-thick: 50px;
  --blur-chrome: 60px;
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-label: #FFFFFF;
    --color-label-secondary: #EBEBF5F2;
    --color-label-tertiary: #EBEBF54D;
    --color-label-quaternary: #EBEBF52E;
    --color-separator: #54545899;
    --color-bg-l1: #000000;
    --color-bg-l2: #1C1C1E;
    --color-bg-l3: #2C2C2E;
    --color-tint: #0A84FF;
    --color-red: #FF453A;
    --color-orange: #FF9F0A;
    --color-yellow: #FFD60A;
    --color-green: #30D158;
  }
}

/* glass materials — repeatable atoms */
@layer components {
  .glass-ultra-thin { @apply backdrop-blur-[20px] backdrop-saturate-[1.8] bg-white/45 dark:bg-[#1C1C1E]/35; }
  .glass-thin       { @apply backdrop-blur-[30px] backdrop-saturate-[1.8] bg-white/60 dark:bg-[#1C1C1E]/50; }
  .glass-regular    { @apply backdrop-blur-[40px] backdrop-saturate-[1.8] bg-white/72 dark:bg-[#1C1C1E]/64; }
  .glass-thick      { @apply backdrop-blur-[50px] backdrop-saturate-[1.8] bg-white/82 dark:bg-[#1C1C1E]/76; }
  .glass-chrome     { @apply backdrop-blur-[60px] backdrop-saturate-[2.0] bg-[#F8F8FA]/90 dark:bg-[#242426]/86; }
}
```

Springs handled in motion lib (Framer Motion / RN Reanimated) — not Tailwind.

| Spring | Stiffness | Damping |
|--------|-----------|---------|
| snappy | 300 | 25 |
| smooth | 200 | 28 |
| bouncy | 250 | 14 |
