# Todo P2P documentation

Todo P2P is a personal macOS and iPhone todo app for one user and two devices.
Both devices must remain independently usable offline and synchronize directly
with their paired peer on the local network. Application data must not be sent
to internet services.

## Reading guide

- [Architecture](architecture/overview.md): planned components, data flow,
  persistence, pairing, synchronization and platform constraints.
- [Stack decision](decisions/0001-native-lan-only-stack.md): selected technologies,
  rationale, alternatives and adoption risks.
- [Roadmap](roadmap.md): initial product scope, completed scaffold and remaining
  implementation and validation milestones.

## Status and provenance

These documents summarize the Obsidian notes `Todo P2P`, `Project Stack`,
`Setup Prompt` and `Working Rules`, read on 2026-10-31. The vault remains the
long-term record of findings and decisions; local repository working instructions
live in `AGENTS.md`, which is excluded from version control.

The repository contains a folder scaffold and documentation only. The architecture
is selected, not implemented or tested. There are no Swift sources, package
manifests, Xcode targets, configured dependencies or runnable tests. Build and
runtime setup remain deferred. Library references carried over from the vault
are background sources, not a new dependency or compatibility validation.
