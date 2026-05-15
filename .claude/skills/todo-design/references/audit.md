# Audit checklist

Run after every UI change. Report ✅ / ⚠️ per line.

- [ ] Touch targets ≥44pt
- [ ] Type ramp adherence — no off-ramp sizes
- [ ] Spacing on 8pt grid — no off-grid values
- [ ] Color = label / semantic only — no decorative hex
- [ ] Glass material matches surface depth (chrome=nav, thick=modal, regular=card, thin=hover, ultraThin=scrim)
- [ ] Motion = spring (snappy/smooth/bouncy) — never linear
- [ ] Icons = `lucide-react` only — no inline SVG, no other icon libs
- [ ] No CSP violations — no remote fonts/images/scripts/CSS
- [ ] Dark mode parity — both schemes rendered + verified
- [ ] Empty + loading + error states designed (not just loaded)
- [ ] A11y labels present on interactive elements
- [ ] Contrast ≥4.5:1 on text vs background
- [ ] `prefers-reduced-motion` respected — spring → fade
- [ ] No `packages/core` UI imports leaked
- [ ] Tailwind utility used where one fits — no reinvented class. `@apply` only in `@layer components`
- [ ] No inline `style={}` attrs (CSP violation)
