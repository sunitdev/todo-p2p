# 0001: Native apps with local Automerge storage and LAN-only synchronization

Date: 2026-10-31

Status: selected direction; dependency compatibility and device behavior unverified.

## Context

One user needs a personal todo app on a Mac and an iPhone. Either device must
remain writable offline, retain changes across restarts and merge independent
edits when the paired devices meet on the LAN. No backend or cloud service is
selected, and application data must not be sent to internet services.

## Decision

| Layer | Selected direction |
| --- | --- |
| Apps | Swift and SwiftUI on macOS and iOS |
| Shared logic | Local `TodoP2PCore` Swift package |
| Replicated state | MIT-licensed `automerge-swift` |
| Repository and sync | MIT-licensed `automerge-repo-swift`, subject to a compatibility spike |
| Discovery and transport | Bonjour peer provider, Network.framework and shared-secret TLS |
| Persistence | Durable Automerge storage in local Application Support |
| Pairing | QR transfer of a strong random secret and workspace ID; non-synchronizing Keychain storage |
| Future tooling | Xcode and Swift Package Manager; Swift Testing or XCTest plus real-device checks |

One user still produces concurrent edits across disconnected devices, which is
why replicated state is needed. Shared logic belongs in a package, with
platform-specific presentation where useful. Keep Automerge integration behind
application-owned boundaries as described in the [architecture](../architecture/overview.md).

“Open source only” means open-source third-party dependencies and no proprietary
sync SDK. Apple system frameworks, including SwiftUI, Network.framework and
Keychain, are allowed. This is not a claim that the entire platform is open source.

## Alternatives and consequences

- Hosted sync, relays and cloud databases conflict with the selected local-only
  product boundary and are excluded.
- SQLite is deferred until there is a demonstrated indexing/query need; do not
  introduce a second authoritative model during setup.
- An open-source UI framework is not required under the current interpretation.
  Requiring one would reopen the SwiftUI choice.
- Shared-secret pairing is the selected initial design. It trusts secret holders
  rather than providing individual device certificate identity.
- The repository wrapper has an evolving API according to the reviewed vault
  sources. Validate the core library and wrapper separately, inspect actual tags
  and compiler compatibility, and pin a verified revision rather than copying
  potentially stale release examples.
- Auto-connect behavior, LAN path restrictions, storage durability, backup
  exclusions and iOS suspension behavior require explicit validation. No build or
  real-device sync result exists yet.

## References from the vault

The vault records a source review on 2026-10-31. These references have not been
revalidated as part of the documentation update:

- [Automerge Swift](https://github.com/automerge/automerge-swift)
- [Automerge Repo Swift](https://github.com/automerge/automerge-repo-swift)
- [Peer-provider implementation notes](https://github.com/automerge/automerge-repo-swift/blob/main/notes/FutureMe.md)
- [MeetingNotes reference app](https://github.com/automerge/meetingnotes/)
- [Automerge conflict handling](https://automerge.org/docs/reference/documents/conflicts/)
