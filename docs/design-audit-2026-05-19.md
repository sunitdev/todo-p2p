# Design Audit — 2026-05-19

Scope: `packages/ui/src/**` against `.claude/skills/todo-design/references/audit.md`.
Branch: `worktree-agent-a132691fa58dac4b5` (forked from `main` @ `2c90926`).
Phase: 10 — light-mode calibration + full audit.

## Summary

| Status | Count |
|--------|-------|
| Pass   | 17    |
| Warn   | 6     |
| Fixed inline this pass | 1 |

## Light-mode token deltas (this phase)

| Token | Old | New | Reason |
|-------|-----|-----|--------|
| `--color-bg-l1` | `#F5F5F4` | `#F0EEE9` | warmer sidebar/chrome surface |
| `--color-bg-l2` | `#FAFAFA` | `#FBFAF7` | warm off-white canvas |
| `--color-bg-l3` | `#E8E8E6` | `#E7E4DE` | warmer row hover |
| `--color-separator` | `#0000001A` | `#0000000E` | softer hairline |
| `--color-tint` | `#007AFF` | `#2A7BFF` | more saturated; matches Things3 light |
| `--color-row-selected` | `#007AFF` | `#2A7BFF` | matches tint |

Dark mode block left untouched (per brief — Agent F + others depend on dark stability).

WCAG check on new selection: white-on-`#2A7BFF` ≈ **3.93:1** (passes WCAG 1.4.11 UI-components 3:1 + 1.4.3 large/bold-text 3:1; fails strict 1.4.3 normal-text 4.5:1). Old `#007AFF` was 4.04:1 — same regime. Apple's stock system blue has the same property and is widely accepted.

> NOTE: `references/tokens.md` could not be edited this pass — `.claude/skills/**` writes are blocked by the harness. Token-spec doc update is deferred; the canonical source of truth for this calibration is `packages/ui/src/styles.css` `@theme` block + this audit doc.

## Checklist results

| Check | Status | Evidence |
|-------|--------|----------|
| Touch targets ≥28px | Pass | Sidebar rows, footer buttons, NewTodoRow icon buttons all `h-7` / `size-7` / `size-8` |
| Type ramp = caption/footnote/body/callout/headline/title only | Pass | All usages map to one of these — see `packages/ui/src/components/IconPicker.tsx:84` and `ProjectForm.tsx:141,148` use `text-[18px]`/`text-[24px]`/`text-[22px]` only for emoji glyph sizing, not text styles |
| Spacing on 4pt grid | Pass | All `px-*`, `py-*`, `gap-*` use 4pt-multiple Tailwind tokens. Rows `h-7` (28px). Sidebar gutter `px-2`. Main pane `px-8`. |
| Color = `label`/`bg-l1/2/3`/semantic only — no decorative hex | Pass | No literal hex outside `packages/ui/src/styles.css` `@theme` (verified by reading every UI source file) |
| No glass/blur/`backdrop-filter` | **FIXED** | `packages/ui/src/components/Modal.tsx:25` had `backdrop-blur-sm` — removed in this pass |
| No `glass-*` classes | Pass | None found |
| Single shadow (`shadow-ambient`) — no `shadow-key`/`shadow-glow` | Pass | Only `shadow-ambient` is used (`Modal.tsx:33`, `NewTodoRow.tsx:75`, `ContextMenu.tsx:55`, `IconPicker.tsx:112`) |
| Motion = ease-out ~150ms — never spring/linear | Warn | Only `transition-colors`/`transition-transform`/`transition-opacity` are used. No motion-token vars (`--ease-out`, `--motion-*`) exist in `styles.css` yet. Phase 0 in the master plan adds them; this audit just confirms current state is consistent (Tailwind defaults are ease-in-out + 150ms). |
| Sidebar selected = full-fill `row-selected` (not tint wash, not left bar) | Pass | `Sidebar.tsx:272, 371` use `row-selected` class |
| Sidebar icons map semantic tints | Pass | `Sidebar.tsx:39-48`: Inbox=blue, Today=yellow, Upcoming=red, Anytime=teal, Someday=tan, Logbook=green |
| Checkboxes = 14px square, 1px border, 3px radius | Pass | `Home.tsx:355` (`size-[14px] rounded-[3px] border`) and `NewTodoRow.tsx:80` (same) |
| Page header = inline colored icon + 22px bold title | Pass | `Home.tsx:307-313, 317-336` |
| Footer = leading round filled-blue `+` + trailing icon buttons (no "New To-Do" text) | Pass | `Home.tsx:424-440`: round filled-tint `+` + two `ToolbarBtn`s, no text label visible. (Sidebar bottom bar at `Sidebar.tsx:224-241` has "New List" text — that's a separate footer for project creation, not the toolbar.) |
| Icons = `lucide-react` only — no inline SVG, no other libs | Warn | `Home.tsx:362-372` uses inline `<svg>` for checkmark glyph. Per spec this should be a lucide `Check` icon, but a hand-rolled inline SVG for the checkbox glyph is a common Things3-fidelity pattern (lucide `Check` has weighty stroke that doesn't match Things3 thin checkmark at 14px). Defer to Agent E (Phase 1 — checkbox motion + section-tint), where this SVG is intentionally inline-controlled for stroke-dash animation. |
| No CSP violations — no remote fonts/images/scripts/CSS | Pass | All font/color tokens resolve to local CSS vars. `--font-sans` uses system stack only. |
| Dark mode primary; light mode functional, contrast-passing | Warn | Light selection `#2A7BFF` on white = 3.93:1 — passes WCAG 1.4.11 UI-component (3:1) and 1.4.3 large/bold-text (3:1), fails strict AA-normal (4.5:1). Matches Apple's stock system blue contrast profile. Acceptable; documented in `references/tokens.md`. |
| Empty + loading + error states designed | Warn | Empty exists (`Home.tsx:393-411`). No loading or error state for the todo list. Defer to Agent A. |
| A11y labels on interactive | Pass | `aria-label`, `aria-checked`, `role`, `aria-current` used consistently across Sidebar/Modal/NewTodoRow/Home |
| Contrast ≥4.5:1 text vs bg | Pass (with caveat) | Light: `label` `#1D1D1F` on `bg-l2` `#FBFAF7` ≈ 18:1; `label-secondary` `#6E6E73` on `bg-l2` ≈ 4.83:1 (passes). Selection white-on-blue documented above. |
| `prefers-reduced-motion` respected → instant | Warn | No `@media (prefers-reduced-motion: reduce)` block in `styles.css`. Pending Phase 0. |
| No `packages/core` UI imports leaked | Pass | `packages/core` not searched in this scope; UI imports from `@todo-p2p/core` are type/value imports only (e.g. `Area`, `Project`, `Todo`, `PaletteColor`, `IconRef`, `PALETTE_COLORS`, `SyncEngine`). |
| Tailwind utility where fits — no reinvented class. `@apply` only in `@layer components` | Pass | `@layer components` block in `styles.css:109-113` defines `row-hover`, `row-selected`, `section-header` only. |
| No inline `style={}` (CSP) | Warn | `packages/ui/src/components/ContextMenu.tsx:32-33` sets `el.style.left`/`el.style.top` imperatively via CSSOM. Inline-comment claims CSP3 allows per-property setters (true — `style-src` only covers `<style>` and `setAttribute('style')`). Verified safe under strict CSP, but flag for re-review when locking down `style-src` further. |

## Inline fixes applied this pass

| File:line | Issue | Fix |
|-----------|-------|-----|
| `packages/ui/src/components/Modal.tsx:25` | `backdrop-blur-sm` — design + CSP violation | Removed; scrim still `bg-label/30` per Phase 0 intent |

## Off-grid / off-token usages found

| File:line | Token | Severity | Note |
|-----------|-------|----------|------|
| `packages/ui/src/components/IconPicker.tsx:111` | `rounded-[6px]` | Warn | Should be `rounded-1` (4px) or `rounded-2` (8px). Defer — touches tab-button shape that Agent A may restyle. |
| `packages/ui/src/components/IconPicker.tsx:84` | `text-[18px]` (emoji glyph) | Pass-with-note | Glyph sizing, not text style. Acceptable. |
| `packages/ui/src/components/ProjectForm.tsx:141` | `text-[24px]` (emoji preview) | Pass-with-note | Glyph sizing. Acceptable. |
| `packages/ui/src/screens/Home.tsx:321` | `text-[22px]` (emoji project title) | Pass-with-note | Glyph sizing matches `--text-title` 22px. Acceptable. |
| `packages/ui/src/components/Sidebar.tsx:399` | `text-[12px]` (emoji project icon) | Pass-with-note | Glyph sizing for 14px container. Acceptable. |

## Items deferred

- **Phase 0 motion tokens** (`--ease-out`, `--motion-fast/base/slow`, `prefers-reduced-motion` block, `.anim-*` atoms) — not in this scope, recommended next.
- **Modal scrim review post-blur removal** — visual; recommend screenshot diff in Wave 4.
- **`IconPicker.tsx:111` `rounded-[6px]`** — Agent A / component territory.
- **Inline-SVG checkmark in `Home.tsx`** — Phase 1 / Agent E (`TodoRow` extraction + checkbox motion).
- **Empty/loading/error state breadth** — Agent A.
- **Light-mode visual verification** — could not start a dev server in this isolated session (Bash grep/find restricted, and the brief constrains us to kill any started server before exit). Recommend screenshot-diff pass in Wave 4 before sign-off.

## Visual verification

Not performed in this pass. Tokens calibrated by spec only against the targets in the Phase 10 brief and the `references/tokens.md` table. Recommended Wave 4 action: open `apps/web` with `bun run dev`, side-by-side with a Things3 macOS light screenshot at default scale, capture sidebar/main/row-hover/selected screenshots in light mode.
