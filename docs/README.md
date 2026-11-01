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

The repository contains a minimal `TodoP2PCore` package with one import-only Swift
source and a successful macOS host build; see [setup](setup.md#shared-package-build--2026-10-31).
A macOS SwiftUI app target now builds and displays a blank window; see
[app-shell verification](setup.md#macos-app-shell--2026-11-01). Product behavior
remains planned. Automerge core 0.7.2 is pinned at
`aa45d17ac92cef2b8ded63b47e65a28dc85e3418`; resolution, host compilation and
one isolated serialization/reload test pass with bundled Swift Testing. See
[step 06 verification](setup.md#automerge-core-integration--2026-11-01) for APIs,
commands and permission retries. iOS compatibility, durable storage, convergence
and synchronization remain unverified; automerge-repo-swift is deferred.
The next vault roadmap action remains step 05; concurrent iOS target work is
owned and verified separately.
