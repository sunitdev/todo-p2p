# Development environment

Observed: 2026-10-31. The inventory below records roadmap step 01; no application build,
dependency compatibility, provisioning or device deployment has been verified.

## Host and selected toolchain

| Command | Observed result |
| --- | --- |
| `sw_vers` | macOS 27.0.1, build 26A434 |
| `uname -m` | `arm64` |
| `xcode-select -p` | `/Applications/Xcode.app/Contents/Developer` |
| `xcodebuild -version` | Xcode 27.1, build 27A9275 |
| `xcrun --find swift` | `/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift` |
| `xcrun swift --version` | Apple Swift 6.4 (`swiftlang-6.4.0.34.1 clang-2100.3.34.1`), driver 1.168.6; target `arm64-apple-macosx27.0.0` |
| `printenv DEVELOPER_DIR TOOLCHAINS` | No output, exit 1: neither override is set in the inventory shell |

These inventory commands succeeded except the expected unset-variable result.

## SDKs and simulator runtimes

`xcodebuild -showsdks` succeeded and listed these installed SDKs:

| Platform | SDK version and selector |
| --- | --- |
| iOS / iOS Simulator | 27.1: `iphoneos27.1`, `iphonesimulator27.1` |
| macOS | 27.0: `macosx27.0` (listed twice) |
| DriverKit | 27.0: `driverkit27.0` |
| tvOS / tvOS Simulator | 27.0: `appletvos27.0`, `appletvsimulator27.0` |
| visionOS / visionOS Simulator | 27.0: `xros27.0`, `xrsimulator27.0` |
| watchOS / watchOS Simulator | 27.0: `watchos27.0`, `watchsimulator27.0` |

`xcrun simctl list runtimes`, after an approved retry outside the sandbox,
succeeded and listed iOS 26.1 (23B86) and iOS 26.5 (23F77). No other runtimes
were listed. SDK availability does not establish runtime availability; no iOS
27.1 simulator runtime was listed.

`xcrun simctl list devices available`, after an approved retry outside the
sandbox, succeeded: 11 available simulator devices per runtime, all Shutdown.
Each runtime has five iPhone and six iPad simulators. Availability is inventory
evidence only; no simulator was deliberately booted and no app was launched.

## Physical devices and signing

`xcrun xctrace list devices`, after an approved retry outside the sandbox,
succeeded. It listed the local Mac under Devices, an iPhone running 26.5.2 and
an Apple Watch running 26.1 under Devices Offline, and 22 simulators separately.
The user confirms the physical phone model is **iPhone 17 Pro Max**; the command
did not establish that model. No accessible online physical iPhone was listed.
Offline listing does not prove device deployment access or successful pairing.

`security find-identity -v -p codesigning` succeeded and reported
`0 valid identities found`, both inside the sandbox and in an approved retry
outside it. This is the result for the queried signing context, not proof that
no certificate exists anywhere. Provisioning and device deployment remain
unverified. No private keys were inspected or signing settings changed.

## Failures, retries and remaining limits

- Initial sandboxed `simctl` queries exited 1: `CoreSimulatorService connection
  became invalid`, log access reported `Operation not permitted`, and device-set
  lookup failed with `Connection refused`. These were not evidence of absent
  runtimes or hardware. Both approved retries returned exit 0 and the inventory
  above.
- Initial sandboxed `xctrace` exited 134: `Cannot create temporary directory for
  Instruments Analysis Core`, with permission denied for the InstrumentsCLI
  `path_manager` cache. The approved retry returned exit 0.
- Successful SDK/Swift queries emitted `Failed to start fs event stream` and
  `Failed to get length of DARWIN_USER_CACHE_DIR` (Code 5, `Input/output error`),
  followed by `Using NSCachesDirectory instead`. Inventory still returned.
- The approved `simctl` queries unexpectedly printed `Install Started` and
  `Install Succeeded`. The runtime query also reported a CoreSimulator version
  change: framework 1174.9.2 versus existing job 1051.55, and an attempt to replace
  the stale service. No install command was requested; the installed component
  was not identified. Do not infer that a runtime was installed, or claim these
  queries had no setup side effects. No further setup operation was attempted.
- All required inventory commands returned results after permission retries.
  Remaining limitations are the offline physical phone, zero valid signing
  identities in the queried context, unverified provisioning/deployment, and
  unidentified automatic setup activity reported by `simctl`.

Step 01 inventory evidence is complete. Subsequent source-based dependency,
deployment-target and test-framework choices are recorded in
[decision 0002](decisions/0002-automerge-dependency-selection.md). During step 01, no source, manifests, projects,
dependencies or placeholders were added; no builds, tests, commits or publishing
were performed. See `Detailed Roadmap` in the Todo P2P Obsidian vault for the next separately
scoped step.

## Shared package build — 2026-10-31

Completed only roadmap step 03 in `/Users/sunit/Workspace/Personal/Projects/todo-p2p`.
The checkout was clean before editing. `Packages/TodoP2PCore/Package.swift`
declares one automatic `TodoP2PCore` library product and one regular source target
of the same name, with no dependencies or test targets. Its sole source,
`Sources/TodoP2PCore/TodoP2PCore.swift`, contains only `import Swift`; it declares
no API or behavior. Domain/Persistence/Sync/Pairing remain empty local directories
without placeholders.

Settings: `// swift-tools-version: 6.4`, `swiftLanguageModes: [.v6]`,
`.macOS("27.0")` and `.iOS("27.0")`. Tools 6.4 matches the selected compiler and
manifest API; explicit Swift 6 mode avoids relying on an implicit default. This
is separate from upstream Automerge packages' tools 5.9 / default Swift 5 mode.

Commands run from the checkout:

```sh
xcrun swift --version
xcrun swift package --package-path Packages/TodoP2PCore dump-package
xcrun swift build --package-path Packages/TodoP2PCore
```

Version returned exit 0: Apple Swift 6.4 (`swiftlang-6.4.0.34.1
clang-2100.3.34.1`), driver 1.168.6, target `arm64-apple-macosx27.0.0`.
The first sandboxed `dump-package` exited 1. SwiftPM warned that its user
configuration, security and cache directories were inaccessible or unwritable,
and reported `You don’t have permission to save the file “manifests” in the folder
“org.swift.swiftpm”.` The manifest compiler then reported:

```text
<unknown>:0: error: error opening '/Users/sunit/.cache/clang/ModuleCache/Swift-7JL1KBZ3A6V3.swiftmodule' for output: /Users/sunit/.cache/clang/ModuleCache: Operation not permitted
<unknown>:0: error: unable to load standard library for target 'arm64-apple-macosx14.0'
```

The final diagnostic was `error: invalid manifests at
[<AbsolutePath:"/Users/sunit/Workspace/Personal/Projects/todo-p2p/Packages/TodoP2PCore">]`.
An approved retry of the same command exited 0. Inspected JSON confirmed tools
6.4.0, language version 6, macOS/iOS 27.0, one library/regular target and empty
dependency lists. The diagnostic's macOS 14.0 target was the manifest compiler
invocation, not a change to the library deployment minimum.

The build ran with approved cache and checkout write access and exited 0,
showing `TodoP2PCore` compilation and `Build complete! (2.58 secs)`.
All 76 generated build files were verified ignored by `.gitignore`'s `.build/`
rule; no `Package.resolved` was generated. No toolchain or deployment target was
changed to work around permissions.

This validates the dependency-free library on the macOS host only. iOS compilation,
simulator/device execution, app linkage, signing, tests and Automerge compatibility
remain unverified. No external dependencies were added or resolved. Core 0.7.2
and wrapper 0.3.2 integration remains in steps 06/07; bundled Swift Testing is
selected for future tests, without a package dependency. Step 04 has not begun.
