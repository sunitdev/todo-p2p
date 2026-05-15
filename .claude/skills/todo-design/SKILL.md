---
name: todo-design
description: Cultured Code / Things3 dark aesthetic for todo-p2p. Dense flat lists, SF Pro tight ramp, semantic sidebar colors, no glass/blur. Use when designing or implementing tokens, components, screens, or auditing UI.
---

# Identity

Lineage = Cultured Code Things. Care: density w/o clutter, calm color, type that disappears, surfaces that don't compete w/ content. Restraint over flourish; motion incidental.

# Things3 non-negotiables

- Flat solid surfaces. No `backdrop-filter`, no blur, no glass.
- SF Pro Text/Display via `--font-sans` only. No webfonts.
- 4pt grid. Rows ~28px. Padding 4/6/8/12. No off-grid.
- Type ramp: caption(11)/footnote(12)/body(13)/callout(14)/headline(15)/title(22). Nothing else.
- Sidebar selected = full-fill `bg-tint` + white text. Not 15% wash, not left-bar.
- Sidebar icons semantic: Inbox=blue, Today=yellow, Upcoming=red, Anytime=teal, Someday=tan, Logbook=green. Flag=orange.
- Checkboxes: 14px square, 1px border, 3px radius. Filled-blue when done.
- Page title: 22px bold + leading colored section icon. No large-title collapse, no glass chrome.
- Motion: ease-out ~150ms. Never spring. Respect `prefers-reduced-motion`.
- Color functional. Backgrounds carry hierarchy (bg-l1=sidebar, bg-l2=main, bg-l3=row hover). Tint = selection + new-item.

# Repo hard constraints

- No remote fonts/CSS/scripts (CSP).
- Icons = `lucide-react`, per-icon import. No inline SVG, no other libs.
- `packages/core` = pure TS. No UI imports.
- Shared UI → `packages/ui/`. Platform screen → `apps/*/src/screens/`.
- Tailwind v4 web/desktop. NativeWind mobile. No styled-components/CSS modules/emotion.
- No inline `style={}` — CSP blocks. Tailwind classes only.
- Bun only.

# Workflow router

| Task | Load |
|------|------|
| Tokens/theme | `references/tokens.md` + `references/tailwind.md` |
| Component build | `references/components.md` |
| Screen layout | `references/screens.md` |
| Review/audit | `references/audit.md` |

# Output discipline

1. State decision + Things3 principle (WHY) in 1 line before code. e.g. "Things3: density w/o clutter — drop chevron, row is its own affordance."
2. Implement.
3. Self-audit against `audit.md`. Report ✅/⚠️ per item.
4. Tailwind utility exists? Use it. `@apply` only inside `@layer components` for true repeatable atoms (`row-hover`, `row-selected`, `section-header`).
5. Lucide icon missing? Pick closest or ask. Never ship blank.

# Stop conditions — ask first

- Install dep beyond Tailwind + lucide + clsx/tailwind-merge.
- Add downloaded font file.
- Touch `apps/desktop/src-tauri/tauri.conf.json` CSP.
- Modify `packages/core`.
- Reintroduce blur/glass/translucency.
