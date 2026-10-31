# Todo P2P documentation

Todo P2P is a personal macOS and iPhone todo app for one user and two devices.
Both devices must remain independently usable offline and synchronize directly
with their paired peer on the local network. Application data must not be sent
to internet services.

## Reading guide

- [Development environment](setup.md): observed toolchain, SDKs, simulator and
  device access, signing inventory and limitations, dated 2026-10-31.

- [Architecture](architecture/overview.md): planned components, data flow,
  persistence, pairing, synchronization and platform constraints.
- [Stack decision](decisions/0001-native-lan-only-stack.md): selected technologies,
  rationale, alternatives and adoption risks.
- [Dependency selection](decisions/0002-automerge-dependency-selection.md): exact
  revisions, source compatibility evidence, product targets and test framework.
- Roadmap: `Detailed Roadmap` in the Todo P2P Obsidian vault is the sole
  implementation checklist; no roadmap copy is maintained in this checkout.

## Status and provenance

These documents summarize the Obsidian notes `Todo P2P`, `Project Stack`,
`Setup Prompt` and `Working Rules`, read on 2026-10-31. The vault remains the
long-term record of findings and decisions; local repository working instructions
live in `AGENTS.md`, which is excluded from version control.

The repository contains a folder scaffold and documentation only. The architecture
is selected, not implemented or tested. There are no Swift sources, package
manifests, Xcode targets, configured dependencies or runnable tests. Build and
runtime setup remain deferred. Decision 0002 records source-based dependency
selection against the observed environment. Resolution, compilation and runtime compatibility remain unverified.
The next vault roadmap action is step 03; this documentation task stops before it.
