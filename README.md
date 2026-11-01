# Todo P2P

A personal todo app for one user on macOS and iPhone. Each device will work
independently offline, store data locally and synchronize with its paired device
over the LAN using Bonjour discovery and TLS. No backend or cloud services are
planned.

The repository contains a minimal, buildable `TodoP2PCore` Swift library and a
macOS SwiftUI app shell with a verified blank window. Product behavior remains
unimplemented. An isolated Automerge serialization test passes on the macOS host.

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
| `Packages/TodoP2PCore/Tests/TodoP2PCoreTests/` | Shared-package integration tests |
| `Tests/Integration/` | Future integration tests |
| `docs/architecture/` | Architecture documentation |
| `docs/decisions/` | Decision records |

Empty scaffold directories remain locally without placeholder files. Git will
retain these directories once they contain tracked files.

## Deferred setup

Product implementation, iOS validation, network permissions and device signing
remain deferred. Automerge core 0.7.2 is pinned and tested on the macOS host;
automerge-repo-swift 0.3.2 remains selected for later integration. Tests use
bundled Swift Testing.

## Shared package

`Packages/TodoP2PCore/Package.swift` declares the `TodoP2PCore` library and source
target, Swift tools 6.4, explicit Swift 6 language mode, and macOS/iOS 27.0
minimums. Its sole source contains only `import Swift`, with no declarations.

```sh
xcrun swift build --package-path Packages/TodoP2PCore
```

The macOS host build passed on 2026-10-31 with Xcode 27.1 / Apple Swift 6.4.
That dependency-free result is historical. On 2026-11-01, resolution, build and
one Automerge serialization/reload test passed with Xcode 27.2 / Swift 6.4.2.
`Package.resolved` retains core 0.7.2 at
`aa45d17ac92cef2b8ded63b47e65a28dc85e3418`, with no additional package pins.

```sh
xcrun swift package --package-path Packages/TodoP2PCore resolve
xcrun swift test --package-path Packages/TodoP2PCore
```

Keep `LOCAL_BUILD` unset to use the released binary artifact. Host success does
not validate iOS compatibility, durable storage, convergence or synchronization.
See [setup](docs/setup.md#automerge-core-integration--2026-11-01) for APIs,
verification and permission details.

## macOS app shell

Open `TodoP2P.xcodeproj` and select the shared `TodoP2PMac` scheme, or run:

```sh
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PMac -configuration Debug \
  -destination 'platform=macOS,arch=arm64' -derivedDataPath DerivedData \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build
open DerivedData/Build/Products/Debug/TodoP2PMac.app
```

The app imports and links the repository-relative local `TodoP2PCore` product.
It uses macOS 27.0, Swift 6, generated Info.plist metadata and local development
bundle identifier `local.sunit.TodoP2PMac`, with ad hoc signing and no team.
Build and visible blank-window checks passed on 2026-11-01 using the then-selected
Xcode 27.2 / Swift 6.4.2. See [setup](docs/setup.md#macos-app-shell--2026-11-01)
for exact verification, permission retries and remaining limits.

## iPhone app shell

The existing project also contains the shared `TodoP2PiOS` scheme and a blank
SwiftUI shell, linked to the same local TodoP2PCore product. It targets iPhone,
iOS 27.0 and Swift 6 with local bundle identifier `local.sunit.TodoP2PiOS`.
Simulator build, installation, launch and visual blank-screen inspection passed
on an iPhone 17 simulator running iOS 27.2. The Mac regression build also passed.
See [iOS verification](docs/setup.md#ios-simulator-launch-verified--2026-11-01)
for commands and evidence. Step 05 is complete; physical-device signing and
deployment remain unverified.
