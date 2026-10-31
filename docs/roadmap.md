# Scope and validation roadmap

Snapshot from the vault notes on 2026-10-31. The folder scaffold and documentation
exist; all application behavior and validation below remain future work.

## Initial product scope

- Create, edit, complete and delete todos while offline.
- Preserve edits across application restarts.
- Pair the Mac and iPhone once and reconnect without entering addresses.
- Merge edits made independently on both devices.
- Display pairing, connection and synchronization state.
- Keep local operations functional when discovery or synchronization fails.

## Milestones

- [x] Initialize app, shared-package, test and documentation directories with
  README and Swift/Xcode/macOS ignore rules. Placeholder files were removed at
  the user's request; empty directories remain local until populated.
- [x] Bring the selected architecture and decisions into repository documentation.
- [ ] Verify and pin compatible Automerge dependencies and compile both app targets.
- [ ] Implement and test durable local todo operations.
- [ ] Establish trusted device pairing and share workspace identity.
- [ ] Demonstrate encrypted Bonjour discovery and bidirectional sync on real devices.
- [ ] Verify convergence after independent edits, retries, reconnects and restarts.
- [ ] Verify operation without internet and inspect traffic with internet available.
- [ ] Document iPhone lifecycle limits and local export/restore.

## Deferred setup and open choices

Implementation, Xcode targets, `Package.swift`, dependency configuration and
resolution, permissions, signing, build/test setup, entitlements and runtime
configuration are deferred. No dependency installation, builds or test runs have
been performed for the scaffold or this documentation update.

Choose deployment targets and toolchain versions only after compatibility
validation. The persistence adapter, exact dependency revisions and any provider
changes needed to enforce LAN-only paths remain unresolved. Detailed todo UX,
final data schema, test framework and export/restore behavior also remain open.

## Future acceptance checks

- Validate local durability independently of network behavior, including restart
  recovery and explicit storage failure reporting.
- Test concurrent text and field edits, scalar conflicts and deletion markers,
  including a previously offline replica returning.
- Test pairing and shared workspace identity, authentication before data exchange,
  reconnects and synchronization errors on actual Mac/iPhone devices.
- Verify platform-specific discovery/auto-connect behavior and reconciliation after
  iPhone suspension and foregrounding.
- Inspect selected network paths through IPv6, VPN and network changes. Test with
  WAN disconnected, then inspect outbound traffic with WAN available.
- Verify non-synchronizing credentials, backup exclusions and local storage
  protection; document the operating-system boundary that the app cannot control.

These are validation goals, not claims of implemented checks or proven guarantees.
