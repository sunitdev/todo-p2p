# Audit checklist

Run after every UI change. Report ✅/⚠️ per line.

- [ ] Touch targets ≥28px (macOS pointer)
- [ ] Type ramp = only `caption/footnote/body/callout/headline/title`
- [ ] Spacing on 4pt grid
- [ ] Color = `label`/`bg-l1/2/3`/semantic only — no decorative hex
- [ ] **No glass/blur/`backdrop-filter`**
- [ ] **No `glass-*` classes**
- [ ] Single shadow (`shadow-ambient`) — no `shadow-key`/`shadow-glow`
- [ ] Motion = ease-out ~150ms — never spring/linear
- [ ] Sidebar selected = full-fill `row-selected` (not tint wash, not left bar)
- [ ] Sidebar icons map semantic tints (Inbox=blue, Today=yellow, Upcoming=red, Anytime=teal, Someday=tan, Logbook=green)
- [ ] Checkboxes = 14px square, 1px border, 3px radius (not 18px, not circular)
- [ ] Page header = inline colored icon + 22px bold title (no large-title collapse, no glass)
- [ ] Footer = leading round filled-blue `+` + trailing icon buttons (no "New To-Do" text)
- [ ] Icons = `lucide-react` only — no inline SVG, no other libs
- [ ] No CSP violations — no remote fonts/images/scripts/CSS
- [ ] Dark mode primary; light mode functional, contrast-passing
- [ ] Empty + loading + error states designed
- [ ] A11y labels on interactive (`aria-label`, `aria-checked`, `role`)
- [ ] Contrast ≥4.5:1 text vs bg
- [ ] `prefers-reduced-motion` respected → instant
- [ ] No `packages/core` UI imports leaked
- [ ] Tailwind utility where fits — no reinvented class. `@apply` only in `@layer components` (`row-hover`, `row-selected`, `section-header`)
- [ ] No inline `style={}` (CSP)
