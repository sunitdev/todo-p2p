# Todo P2P

A personal todo app for one user on macOS and iPhone. Each device will work
independently offline, store data locally and synchronize with its paired device
over the LAN using Bonjour discovery and TLS. No backend or cloud services are
planned.

The repository contains a minimal, buildable `TodoP2PCore` Swift library.
Application behavior, app targets and tests remain unimplemented.

## Planned stack

- Swift and SwiftUI for the macOS and iOS apps.
- A shared Swift package for domain logic, persistence, synchronization and device
  pairing.
- MIT-licensed `automerge-swift` and `automerge-repo-swift` dependencies, subject to
  later compatibility validation. Apple system frameworks are allowed.

## Directory responsibilities

| Directory | Intended responsibility |
| --- | --- |
| `Apps/macOS/` | macOS app sources and resources |
| `Apps/iOS/` | iPhone app sources and resources |
| `Packages/TodoP2PCore/Sources/TodoP2PCore/Domain/` | Shared domain logic |
| `Packages/TodoP2PCore/Sources/TodoP2PCore/Persistence/` | Local durable storage |
| `Packages/TodoP2PCore/Sources/TodoP2PCore/Sync/` | Paired LAN synchronization |
| `Packages/TodoP2PCore/Sources/TodoP2PCore/Pairing/` | Device pairing and trust |
| `Packages/TodoP2PCore/Tests/TodoP2PCoreTests/` | Future shared-package tests |
| `Tests/Integration/` | Future integration tests |
| `docs/architecture/` | Architecture documentation |
| `docs/decisions/` | Decision records |

Empty scaffold directories remain locally without placeholder files. Git will
retain these directories once they contain tracked files.

## Deferred setup

Application implementation, Xcode targets, external dependency configuration and
resolution, permissions, signing and tests remain deferred. No external
dependencies are configured. Automerge core 0.7.2 and wrapper 0.3.2 are selected
for later integration; future tests will use bundled Swift Testing.

## Shared package

`Packages/TodoP2PCore/Package.swift` declares the `TodoP2PCore` library and source
target, Swift tools 6.4, explicit Swift 6 language mode, and macOS/iOS 27.0
minimums. Its sole source contains only `import Swift`, with no declarations.

```sh
xcrun swift build --package-path Packages/TodoP2PCore
```

The macOS host build passed on 2026-10-31 with Xcode 27.1 / Apple Swift 6.4.
This does not validate iOS compilation, simulator/device execution or Automerge
compatibility. See [setup](docs/setup.md) for verification and permission details.
