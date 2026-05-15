# Audit checklist

Run after every UI change. Report ✅ / ⚠️ per line.

- [ ] Touch targets ≥28px (Things3 density; macOS pointer, not iOS finger)
- [ ] Type ramp adherence — only `caption / footnote / body / callout / headline / title`
- [ ] Spacing on 4pt grid — no off-grid values
- [ ] Color = `label` / `bg-l1/2/3` / semantic only — no decorative hex
- [ ] **No glass / no blur / no `backdrop-filter`** anywhere
- [ ] **No `glass-*` classes** referenced (they no longer exist)
- [ ] Single shadow scale (`shadow-ambient`) — no `shadow-key`, no `shadow-glow`
- [ ] Motion = ease-out ~150ms — never spring, never linear
- [ ] Sidebar selected row = full-fill `row-selected`, not a tint/15% wash, not a left bar
- [ ] Sidebar icons map to semantic tints (Inbox=blue, Today=yellow, Upcoming=red, Anytime=teal, Someday=tan, Logbook=green)
- [ ] Checkboxes = 14px square, 1px border, 3px radius (not 18px, not circular)
- [ ] Page header = inline colored icon + 22px bold title (no large-title collapse, no glass chrome)
- [ ] Bottom footer = leading round filled-blue `+` + trailing icon buttons (no "New To-Do" text label)
- [ ] Icons = `lucide-react` only — no inline SVG, no other icon libs
- [ ] No CSP violations — no remote fonts/images/scripts/CSS
- [ ] Dark mode is primary; light mode functional and contrast-passing
- [ ] Empty + loading + error states designed
- [ ] A11y labels present on interactive elements (`aria-label`, `aria-checked`, `role`)
- [ ] Contrast ≥4.5:1 on text vs background
- [ ] `prefers-reduced-motion` respected — transitions collapse to instant
- [ ] No `packages/core` UI imports leaked
- [ ] Tailwind utility used where one fits — no reinvented class. `@apply` only in `@layer components` (`row-hover`, `row-selected`, `section-header`)
- [ ] No inline `style={}` attrs (CSP violation)
