# scripts/

Build / maintenance scripts. Add Bun shell scripts here when needed (codegen, asset processing, schema sync between TS/Rust migrations, etc.).

Conventions:
- Bun-runnable: `bun scripts/<name>.ts`
- Idempotent — re-runnable without side effects.
- No network egress (per CLAUDE.md critical rules).
