# Todo P2P

A personal todo app for one user on macOS and iPhone. Each device will work
independently offline, store data locally and synchronize with its paired device
over the LAN using Bonjour discovery and TLS. No backend or cloud services are
planned.

This repository is a **structure-only scaffold** and is intentionally not
buildable. It contains no application or test code.

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

Application implementation, Xcode targets, `Package.swift`, dependency
configuration and resolution, permissions, signing, and build/test setup are
deferred. No dependencies have been installed and no builds or tests have been
run for this scaffold.
