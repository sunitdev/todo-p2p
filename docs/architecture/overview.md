# Planned architecture

Status: selected direction from the vault notes, documented on 2026-10-31.
Nothing described below has been implemented or verified in this application.
See the [stack decision](../decisions/0001-native-lan-only-stack.md) and
[validation roadmap](../roadmap.md).

## Components and ownership

| Location | Planned responsibility |
| --- | --- |
| `Apps/macOS/` | Native SwiftUI macOS presentation and platform integration |
| `Apps/iOS/` | Native SwiftUI iPhone presentation and platform integration |
| `Packages/TodoP2PCore/…/Domain/` | Shared todo and workspace logic |
| `Packages/TodoP2PCore/…/Persistence/` | Durable local Automerge storage |
| `Packages/TodoP2PCore/…/Sync/` | Paired peer discovery and synchronization |
| `Packages/TodoP2PCore/…/Pairing/` | Workspace identity and device trust setup |
| `Packages/TodoP2PCore/Tests/` | Future shared logic verification |
| `Tests/Integration/` | Future cross-component and device verification |

The abbreviated core paths refer to `Sources/TodoP2PCore/`. Library integration
is planned behind application-owned `WorkspaceStore` and `SyncService`
boundaries. These names describe intended responsibilities, not existing APIs.

## Local edits and replicated data

Begin with one small Automerge workspace document containing a map of todos keyed
by stable UUIDs. Suggested fields are title, optional notes, completion state,
creation metadata and a persistent deletion marker. The detailed schema and todo
UX are still open.

Use CRDT text for editable text and update individual fields rather than replacing
whole records. Creation timestamps are display metadata; they do not determine
causality or conflict winners. Concurrent scalar assignments require documented
semantics, including the deterministic winner and access to competing values.
Do not promise that every concurrent edit remains visible.

The selected initial deletion policy hides records with a deletion marker even
when concurrent edits arrive. Retain markers while an old replica can return.

Persist local edits without waiting for a peer, and persist merged remote state.
Use durable storage in app-local Application Support, with atomic writes and
explicit saved/error state. Validate the repository library's storage adapter or
implement its storage interface later. Do not introduce a second authoritative
model or SQLite during the initial integration.

The intended flow is a local edit, local persistence and peer synchronization when
available; incoming merged state is also persisted locally. Local editing must
continue through discovery or synchronization failures. Expose saved locally,
connected, synchronizing and synchronization error as distinct states. A connected
socket alone does not establish that edits reached the peer.

## Pairing and transport

Pair the Mac and iPhone once using a strong random secret transferred by QR code.
Transfer the workspace document ID with the credentials so both devices join the
same workspace. Store credentials in non-synchronizing Keychain items. This shared
secret design trusts holders of the secret; it does not provide per-device
certificate identity.

The planned transport is the Bonjour peer provider in `automerge-repo-swift`,
backed by Network.framework and shared-secret TLS. Its configuration, platform
auto-connect defaults and actual LAN restrictions must be checked in the eventual
pinned source. Authenticate before exchanging documents. Advertise minimal
discovery metadata, with no credentials or todo content in Bonjour TXT records.

## LAN-only and storage boundaries

- Configure only the local peer transport. No public WebSocket adapters, relays,
  backend, cloud database, analytics or remote crash reporting.
- Inspect interface and path selection, including IPv6, VPNs and network changes.
  Wi-Fi connectivity or a private IPv4 address alone does not establish LAN-only
  routing. Fail closed when the selected route is not permitted.
- Keep runtime data outside iCloud containers and exclude app-controlled data from
  cloud backup where supported. Document OS-managed copies beyond app control.
- TLS protects transport, not document files at rest. The initial direction relies
  on configured platform storage protection; that protection still needs validation.

## iPhone lifecycle

The baseline is automatic discovery and synchronization while both apps are
running, followed by reconciliation when the iPhone app becomes active again.
iOS may suspend the app. Do not promise a wakeup whenever the phone joins Wi-Fi
or use unrelated background modes to keep it alive.

Test offline operation with WAN disconnected and inspect outbound traffic with WAN
available as separate checks. Neither encrypted transport nor successful discovery
by itself proves the application's LAN-only requirement.
