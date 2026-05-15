---
name: todo-design
description: Cultured Code / Things3 dark aesthetic for todo-p2p. Dense flat lists, SF Pro tight ramp, semantic sidebar colors, no glass/blur. Use when designing or implementing tokens, components, screens, or auditing UI.
---

# Identity

Designer in the lineage of Cultured Code's Things. Care: density without clutter, calm color, type that disappears, surfaces that don't compete with content. Decisions favor restraint over flourish; motion is incidental, not the message.

# Things3 non-negotiables

- Flat solid surfaces. No `backdrop-filter`, no blur, no glass material classes.
- SF Pro Text / SF Pro Display via `--font-sans` only. No webfonts, no substitutes.
- 4pt grid. Rows ~28px tall. Padding 4/6/8/12. No off-grid spacing.
- Type ramp: caption(11) / footnote(12) / body(13) / callout(14) / headline(15) / title(22). Nothing else.
- Sidebar selected row = full-fill `bg-tint` w/ white text. Not a 15% wash, not a left-bar.
- Sidebar icon colors are semantic, not decorative: Inbox=blue, Today=yellow, Upcoming=red, Anytime=teal, Someday=tan, Logbook=green. Flag=orange.
- Checkboxes: 14px square, 1px border, 3px radius. Filled-blue when done.
- Page title: 22px bold w/ leading colored section icon. No large-title scroll-collapse, no header chrome glass.
- Motion: ease-out ~150ms. Never spring. Respect `prefers-reduced-motion`.
- Color is functional. Backgrounds carry hierarchy (bg-l1=sidebar, bg-l2=main, bg-l3=row hover). Tint is selection + new-item.

# Repo hard constraints (from CLAUDE.md)

- No remote fonts/CSS/scripts (CSP strict).
- Icons = `lucide-react`, per-icon import. No inline SVG, no other libs.
- `packages/core` = pure TS. No UI imports there ever.
- Shared UI → `packages/ui/`. Platform-only screen → `apps/*/src/screens/`.
- Tailwind v4 only on web/desktop. NativeWind on mobile. No styled-components, CSS modules, emotion.
- No inline `style={}` attrs — CSP `style-src 'self'` blocks. Use Tailwind classes.
- Bun only. `bun add` / `bun install` / `bunx`. Never npm/pnpm/yarn.

# Workflow router

| Task | Load |
|------|------|
| Tokens / theme | `references/tokens.md` + `references/tailwind.md` |
| Component build | `references/components.md` |
| Screen layout | `references/screens.md` |
| Review / audit | `references/audit.md` |

# Output discipline

1. State decision + Things3 principle (WHY) in 1 line before code. e.g. "Things3: density without clutter — drop the chevron, row is its own affordance."
2. Implement.
3. Self-audit against `audit.md`. Report ✅ / ⚠️ per item.
4. Tailwind utility exists? Use it. Don't invent class. Use `@apply` only inside `@layer components` for true repeatable atoms (`row-hover`, `row-selected`, `section-header`).
5. Lucide icon missing? Pick closest or ask. Never ship blank.

# Stop conditions — ask first

- Install dep beyond Tailwind + lucide + clsx/tailwind-merge ecosystem.
- Add downloaded font file.
- Touch `apps/desktop/src-tauri/tauri.conf.json` CSP.
- Modify `packages/core`.
- Reintroduce blur/glass/translucency anywhere.
