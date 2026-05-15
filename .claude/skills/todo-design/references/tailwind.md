# Tailwind v4

## Install

```sh
bun add -d tailwindcss @tailwindcss/vite
bun add clsx tailwind-merge
```

Bun only. Tailwind v4 needs no `postcss.config` and no `tailwind.config.{js,ts}` — the config lives in CSS via `@theme`.

## Vite plugin wiring (`apps/web/vite.config.ts`)

```ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), devCspPlugin()],
  // …
});
```

## Stylesheet location

Tokens + base layer live in `packages/ui/src/styles.css` (see `tokens.md` for the full `@theme` block). Apps import it once at entry:

```ts
// apps/web/src/main.tsx
import '@todo-p2p/ui/styles.css';
```

Add `"./src/styles.css": "./src/styles.css"` to `packages/ui/package.json` `exports`.

## CSP compatibility

- Production CSP `style-src 'self'` — Tailwind ships one bundled stylesheet served same-origin → ✅.
- Never use inline `style={}` attrs — browsers fall back to `style-src` and block them.
- No `@font-face` remote URL. System fonts only via `--font-sans`.
- Vite dev injects HMR styles via `<style>` — keep `'self'` only; Vite uses CSSOM, not inline strings, so no CSP relaxation needed.
- Things3 design has no `backdrop-filter` / blur — so the `wasm-unsafe-eval` CSP exception remains the only relaxation, and `style-src` stays strict `'self'`.

## Utility helper

```ts
// packages/ui/src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
```

## Mobile (NativeWind) — when `apps/mobile` scaffolds

`bun add nativewind` + `bun add -d tailwindcss`. Same `@theme` token CSS shared via `packages/ui/src/styles.css`. Babel preset wires `className` → style at build. Skip until mobile app exists.
