# Tailwind v4

## Install

```sh
bun add -d tailwindcss @tailwindcss/vite
bun add clsx tailwind-merge
```

Bun only. Tailwind v4 needs no `postcss.config` / `tailwind.config.{js,ts}` — config in CSS via `@theme`.

## Vite plugin (`apps/web/vite.config.ts`)

```ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), devCspPlugin()],
});
```

## Stylesheet location

Tokens + base in `packages/ui/src/styles.css` (see `tokens.md`). Apps import once:

```ts
// apps/web/src/main.tsx
import '@todo-p2p/ui/styles.css';
```

Add `"./src/styles.css": "./src/styles.css"` to `packages/ui/package.json` `exports`.

## CSP compatibility

- Prod CSP `style-src 'self'` — Tailwind ships 1 bundled stylesheet same-origin → ✅
- Never inline `style={}` — falls back to `style-src`, blocked.
- No `@font-face` remote. System fonts via `--font-sans`.
- Vite dev injects HMR styles via `<style>` w/ CSSOM → no CSP relaxation needed.
- Things3 has no `backdrop-filter` → `wasm-unsafe-eval` stays only relaxation; `style-src` stays `'self'`.

## Utility helper

```ts
// packages/ui/src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
```

## Mobile (NativeWind) — when `apps/mobile` scaffolds

`bun add nativewind` + `bun add -d tailwindcss`. Same `@theme` tokens shared via `packages/ui/src/styles.css`. Babel preset wires `className` → style at build. Skip until mobile exists.
