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

## macOS app shell — 2026-11-01

Completed only roadmap step 04 in `/Users/sunit/Workspace/Personal/Projects/todo-p2p`.
Step 03 completion was confirmed from its documented successful package build,
vault checklist and commit `05c845c`, rather than inferred from package files.
The checkout was clean and no Xcode project existed; no unfinished step 03 work
required coordination. Historical inventory and prompt-writing observations remain
valid for their recorded times.

Added hand-authored `TodoP2P.xcodeproj/project.pbxproj`, shared scheme
`TodoP2P.xcodeproj/xcshareddata/xcschemes/TodoP2PMac.xcscheme` and
`Apps/macOS/Sources/TodoP2PMacApp.swift`. There is one macOS application target,
`TodoP2PMac`, with Debug/Release configurations. The app imports SwiftUI and
TodoP2PCore and creates only a blank WindowGroup (480 × 320 initial/minimum content
size). No resources, features, entitlements, external dependencies or tests were added.

The project uses `XCLocalSwiftPackageReference.relativePath = Packages/TodoP2PCore`
and links the `TodoP2PCore` product in its Frameworks phase. Package sources and
manifest are unchanged: tools 6.4, Swift 6 mode, macOS/iOS 27.0. No package API was
invented. Xcode also exposes the package's automatic TodoP2PCore scheme; the only
application target/shared app scheme is TodoP2PMac.

Effective Debug settings: `MACOSX_DEPLOYMENT_TARGET = 27.0`, `SWIFT_VERSION = 6.0`,
`SUPPORTED_PLATFORMS = macosx`, `GENERATE_INFOPLIST_FILE = YES`,
`PRODUCT_BUNDLE_IDENTIFIER = local.sunit.TodoP2PMac`, version 1.0/build 1,
`CODE_SIGN_STYLE = Manual`, `CODE_SIGN_IDENTITY = -`. Release inherits the same
platform, language, metadata and signing settings. This bundle ID is for local
development, not a registered distribution identity. No team, account, certificate,
provisioning or global settings were changed. No separate Info.plist is required.

### Commands and observed outcomes

Commands below ran from the source checkout unless a path is absolute:

```sh
xcode-select -p
xcodebuild -version
xcrun swift --version
sw_vers
xcodebuild -list -project TodoP2P.xcodeproj
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PMac -configuration Debug \
  -destination 'platform=macOS,arch=arm64' -derivedDataPath DerivedData \
  -showBuildSettings > /private/tmp/todo-p2p-step04-settings.log 2>&1
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PMac -configuration Debug \
  -destination 'platform=macOS,arch=arm64' -derivedDataPath DerivedData \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build \
  > /private/tmp/todo-p2p-step04-build.log 2>&1
open DerivedData/Build/Products/Debug/TodoP2PMac.app
plutil -p DerivedData/Build/Products/Debug/TodoP2PMac.app/Contents/Info.plist
codesign -dv DerivedData/Build/Products/Debug/TodoP2PMac.app
```

- Current selected path is still `/Applications/Xcode.app/Contents/Developer`.
  It now reports Xcode 27.2 (27B52), Swift 6.4.2
  (`swiftlang-6.4.2.1.9 clang-2100.4.1.1`), driver 1.168.6, arm64 target.
  SDKROOT is MacOSX27.2.sdk. Host remains macOS 27.0.1 (26A434).
  Earlier planning/inventory observed Xcode 27.1. This task did not change Xcode
  selection or install anything; retain the earlier results as historical evidence.
- Initial sandboxed project listing exited 74 with `You don’t have permission to
  save the file “repositories” in the folder “SourcePackages”.` It also reported
  denied Xcode log directories, fs event/cache warnings and simulator service errors.
  Approved retry exited 0, resolving only TodoP2PCore at the local repository path.
  Settings inspection and both host builds used approved cache/checkout access.
- Settings inspection exited 0. The initial build exited 0 with
  `** BUILD SUCCEEDED **`; package compilation and the app/package dependency graph
  confirmed local integration. A traditional-headermap warning was resolved by
  explicit `ALWAYS_SEARCH_USER_PATHS = NO`; the final rebuild also exited 0.
- Xcode reports `CoreSimulator is out of date. Current version (1174.9.2) is older
  than build version (1174.21.0).` Simulator device support is disabled. This did
  not block the macOS build; no repair, runtime installation or iOS check was attempted.
- `open` exited 0 with approved GUI launch access. CUA `getApp` and
  `getAXStateAndScreenshot` directly showed a focused standard window titled
  `TodoP2PMac` and a blank dark content area. The screenshot and accessibility
  observation satisfy the visible-window check separately from build/launch exits.
  The app was left running. No screenshot is added to the repository.
- Generated plist inspection exited 0 and confirmed APPL bundle type, identifier,
  executable and `LSMinimumSystemVersion = 27.0`. `codesign -dv` exited 0 and
  confirmed arm64, `Signature=adhoc`, and `TeamIdentifier=not set`.
- Computer Use skill discovery found no `orca` executable (`command not found`,
  exit 127); the available CUA tool supplied GUI verification instead. An early
  CUA lookup before the build completed returned invalid app; the post-launch
  bundle-ID lookup succeeded. A temporary-script `py_compile` check failed because
  the sandbox denied `/Users/sunit/Library/Caches/com.apple.python/private/tmp`;
  the actual script executed successfully with approved source-checkout access.

DerivedData and user-specific Xcode state remain ignored by existing rules;
project.pbxproj and the shared scheme remain trackable. No lockfile was needed.
This verifies only a dependency-free macOS app shell and local package integration.
iOS, Automerge compatibility, persistence, pairing, discovery, networking and sync
remain unverified. Step 05 is next and was not started. No commits or publishing.

Final review: manually inspected the app source, project, shared scheme and
repository documentation diff. `git diff --check` passed. A separate read-only
check covered whitespace/newlines in all seven changed/new repository files and
three vault notes, resolved relative repository documentation file links, parsed
scheme XML and confirmed project/scheme trackability and generated/user-state
ignore rules. Package diff is empty; no repository roadmap or lockfile was added.
Final effective-settings inspection exited 0 after the header-search fix. Files
remain unstaged and uncommitted.

## Automerge core integration — 2026-11-01

Completed roadmap step 06 in `/Users/sunit/Workspace/Personal/Projects/todo-p2p`.
Rechecked decision 0002 and the vault selection before editing. The checkout was
clean at implementation start, following macOS shell commit `fb3f7a1`; app/project
files and existing app evidence were preserved. This task owns package dependencies,
resolution and package tests and does not depend on app-target completion.

`Packages/TodoP2PCore/Package.swift` now requires
`https://github.com/automerge/automerge-swift` at exact version `0.7.2`.
Retained package-level `Package.resolved` pins only `automerge-swift`, at full
revision `aa45d17ac92cef2b8ded63b47e65a28dc85e3418`; the resolved checkout HEAD
matches. There are no additional Swift package dependencies to review. The
upstream manifest's `Automerge` library product includes `Automerge` and
`AutomergeUtilities`; this product is linked to the core and test targets.
Tools 6.4, explicit Swift 6 mode and macOS/iOS 27.0 minimums are unchanged.
Upstream retains its own tools 5.9/default Swift 5 language settings.

`LOCAL_BUILD` was absent (`printenv LOCAL_BUILD`: no output, exit 1). Upstream
checks presence, so even an empty value would select a local XCFramework and
extra unsafe concurrency flags. SwiftPM downloaded the normal released
`https://github.com/automerge/automerge-swift/releases/download/0.7.2/automergeFFI.xcframework.zip`
(54.3 MB), using manifest checksum
`10245378e74229b026f689b039d7df3cf17aeed353706d5f420dfd164f283a86`.
No Rust build or toolchain installation was needed.

Added `Tests/TodoP2PCoreTests/AutomergeRoundTripTests.swift` beneath the package,
using bundled `Testing`, with no external swift-testing dependency. The single
`documentSerializationRoundTrip()` probe creates `Document()`, writes synthetic
`.String("round-trip-value")` at `ObjId.ROOT` / key `"probe"` via
`put(obj:key:value:)`, serializes with `save() -> Data`, checks nonempty bytes,
constructs a distinct object with `try Document(bytes)`, and asserts
`get(obj:key:) -> Value?` equals `.Scalar(.String("round-trip-value"))`.
Pinned `Sources/Automerge/{Document,Value,ScalarValue,ObjId}.swift` and the manifest
were inspected rather than borrowing README examples. The test has no app storage,
networking, workspace schema or production wrapper; the core source stays import-only.

Commands from the checkout, with selected Xcode 27.2 (27B52), Apple Swift 6.4.2
(`swiftlang-6.4.2.1.9 clang-2100.4.1.1`), driver 1.168.6:

```sh
xcrun swift package --package-path Packages/TodoP2PCore resolve
xcrun swift build --package-path Packages/TodoP2PCore
xcrun swift test --package-path Packages/TodoP2PCore
```

- Initial sandboxed resolve exited 1. SwiftPM warned that user configuration,
  security and cache directories were inaccessible or unwritable. Manifest compilation
  reported `error opening '/Users/sunit/.cache/clang/ModuleCache/Swift-18Y2CYADWFGX0.swiftmodule' for output: /Users/sunit/.cache/clang/ModuleCache: Operation not permitted`
  and `unable to load standard library for target 'arm64-apple-macosx14.0'`.
  This is a cache-access failure, not evidence of an incompatible package API;
  macOS 14.0 here is the manifest compiler target, not the product minimum.
- The approved resolve retry exited 0 and fetched version 0.7.2 and its released
  binary artifact. Build and test then ran with approved cache/checkout access.
- Build exited 0: `Build complete! (7.77 secs)`, compiling AutomergeUniffi,
  Automerge, AutomergeUtilities and TodoP2PCore.
- Test exited 0 after `Build complete! (5.53 secs)`. Bundled Testing Library 2403
  discovered `documentSerializationRoundTrip()` and passed it after 0.002 seconds:
  `Test run with 1 test in 0 suites passed`. The preceding XCTest output
  `Executed 0 tests` is a separate runner, not missing Swift Testing discovery.
  Its reported Testing target `arm64e-apple-macos14.0` does not change the manifest's
  macOS/iOS 27.0 minimums. No compiler, API or binary-linkage failure occurred.
- During planning, web reads of pinned Document.swift returned `Cache miss`, and
  a sandboxed Python source read failed with `<urlopen error [Errno 8] nodename nor servname provided, or not known>`.
  Approved pinned-source reads succeeded, then the resolved checkout confirmed
  the same APIs. These were source-access restrictions, not dependency failures.

This proves macOS host compilation, binary linkage and an in-memory serialization/
reload round trip only. iOS compatibility, app linkage with this dependency,
durable storage, convergence, synchronization, provider behavior and security
remain unverified. No automerge-repo-swift, app/project edits, product features,
persistence, networking, commits or publishing were added. Step 07 was not started.
Only step 06 is newly complete; step 05 remains the earliest unfinished action.

Review: inspected tracked diffs, the new test and Package.resolved, and confirmed
`git diff --check` passes. All 3,268 generated package files are ignored; the
lockfile and test remain trackable. New-file and changed vault-section whitespace
checks pass. No repository roadmap copy exists. Concurrent iOS source, scheme
and project changes appeared during final review and were left untouched; this
task neither verifies them nor changes step 05 completion. The next action stays
at the earliest unfinished step, 05, until its owner records successful checks.

## iOS app shell — 2026-11-01

Step 05 configuration is added in the existing TodoP2P.xcodeproj, alongside
TodoP2PMac: target/shared scheme TodoP2PiOS and Apps/iOS/Sources/TodoP2PiOSApp.swift.
The source imports SwiftUI and TodoP2PCore and displays only a blank system
background. Both configurations specify iOS 27.0, Swift 6, iPhone family 1,
iphoneos/iphonesimulator support and no Catalyst. The target overrides the
project's macOS SDK and clears its inherited macOS deployment setting. It reuses
the sole Packages/TodoP2PCore local reference and links its library product.
Existing Mac objects and its scheme are unchanged.

Generated Info.plist includes scene/launch metadata; version is 1.0/build 1.
`local.sunit.TodoP2PiOS` is a local development bundle identifier. iOS uses
automatic signing with Apple Development identity and no team, independently of
the Mac's manual ad hoc signing. Simulator builds disable signing on the command
line. Physical-device provisioning, an online phone and device installation are
unverified; no accounts, certificates or provisioning were changed.

Fresh selected toolchain: /Applications/Xcode.app/Contents/Developer,
Xcode 27.2 (27B52), Apple Swift 6.4.2 (swiftlang-6.4.2.1.9), iOS/simulator SDK
27.2. Approved `xcrun simctl list runtimes` and `xcrun simctl list devices available`
now exit 0 and list only iOS 26.1 (23B86) and 26.5 (23F77), with all devices
Shutdown. No iOS 27 runtime exists in that inventory. During planning the
sandboxed queries failed with `CoreSimulatorService connection became invalid`,
`Connection refused` and denied log access. The approved retry printed
`Install Started` / `Install Succeeded` for an unidentified component; a later
approved refresh succeeded without installation output. This supersedes the
service-mismatch diagnosis as the current query result, not the historical
observation. A working inventory service does not prove successful app launch.

Step 06 completion was confirmed before final app verification against commit
`e4529a8` (Pin Automerge core and verify document serialization). Project listing,
iOS destination listing and Debug/Release effective-settings commands exited 0.
The simulator Debug build and existing Mac Debug regression build both exited 0
with `** BUILD SUCCEEDED **`, using the commands below. The iOS dependency graph
includes TodoP2PCore and Automerge; generated plist confirms MinimumOSVersion
27.0, UIDeviceFamily [1], local.sunit.TodoP2PiOS, scene manifest and launch screen.
Both builds report only `Metadata extraction skipped, no AppIntents.framework
dependency found`; this blank shell has no App Intents.

Xcode reports the exact launch blocker for the available iPhone 17 Pro:
`iPhone 17 Pro’s iOS Simulator 26.5 doesn’t match TodoP2PiOS.app’s iOS Simulator
27.0  deployment target.` No eligible concrete iPhone simulator exists. No
installation, launch or visual verification was claimed from the generic build.
Physical-device deployment was not attempted.

Xcode generated project.xcworkspace/xcshareddata/swiftpm/Package.resolved, retained
as trackable shared project resolution; its sole Automerge pin matches the
package-owned 0.7.2 revision aa45d17ac92cef2b8ded63b47e65a28dc85e3418. Existing
package pins, manifest and tests were not changed. Manifest SHA-256 before/after:
707757098803f4021c5ee58449c3ad53546f8f05626ce799f9562c898946163b; package
resolution SHA-256: f76a0ede2878c8330966b43f16e940303d5c5e30b38a2b380fc8e424df3af392.
Logs are /private/tmp/todo-p2p-step05-{list,destinations,debug,release,ios-build,mac-build}.log.
The package manifest, pins and tests are owned by that work and were not edited.
Static review passes: project plist syntax, both scheme XML files, unchanged Mac
objects, exactly one local package reference, trackable project/shared scheme/
source files, ignored DerivedData, and git diff --check.

Run after coordination, from the repository root:

```sh
xcodebuild -list -project TodoP2P.xcodeproj
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -showdestinations
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData/Step05 \
  -showBuildSettings
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -configuration Release \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData/Step05 \
  -showBuildSettings
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData/Step05 \
  CODE_SIGNING_ALLOWED=NO build
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PMac -configuration Debug \
  -destination 'platform=macOS,arch=arm64' -derivedDataPath DerivedData/Step05 \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build
```

Required remaining setup is a compatible iOS 27-or-newer simulator runtime through
Xcode Settings > Components, using the environment's approval process for any
setup/download. Recheck destinations afterward; boot a compatible iPhone, install
and launch the built app, and inspect its visible blank screen separately from
command exits. No runtime download was requested and no simulator was booted,
installed to or launched during this task. Do not lower the deployment target.
Step 05 remains unchecked until simulator build and visible launch pass.

## iOS simulator launch verified — 2026-11-01

Step 05 is complete. Following explicit user authorization and approved system
setup, `xcodebuild -downloadPlatform iOS` downloaded the arm64 iOS 27.2 Simulator
24B8117 (8.32 GB). `simctl list runtimes` confirms
com.apple.CoreSimulator.SimRuntime.iOS-27-2; the earlier 26.1/26.5-only inventory
and missing-runtime blocker above are superseded. Xcode also automatically
installed a second iOS 27.2 build, 24B91016s, in the same download operation.
The download command exited 0; `simctl runtime list` reports both new images
Ready. The second runtime identifier is iOS-27-2-iPhone19-4; launch evidence
below uses the general iOS-27-2 runtime, build 24B8117. Four runtime disk images
now total 31.2G, including the two existing images. No old runtimes were removed.

Selected toolchain remains Xcode 27.2 (27B52) / Swift 6.4.2. A fresh generic
simulator build exited 0 with `** BUILD SUCCEEDED **`; the destination listing
now includes iPhone 17, iOS 27.2, UUID E1877D46-004A-4FBD-BE85-8C3695258F17.
Boot and bootstatus exited 0 (first boot completed migration in 39 seconds).
Install exited 0; launch exited 0 and returned `local.sunit.TodoP2PiOS: 65541`.
A separately captured simulator screen was opened and visually inspected: blank
white app content, status bar and home indicator, with no error or crash screen.
This is rendered-screen evidence in addition to successful command exits.

```sh
xcodebuild -downloadPlatform iOS
xcrun simctl list runtimes
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -showdestinations
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData/Step05 \
  CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot E1877D46-004A-4FBD-BE85-8C3695258F17
xcrun simctl bootstatus E1877D46-004A-4FBD-BE85-8C3695258F17
xcrun simctl install E1877D46-004A-4FBD-BE85-8C3695258F17 \
  DerivedData/Step05/Build/Products/Debug-iphonesimulator/TodoP2PiOS.app
xcrun simctl launch E1877D46-004A-4FBD-BE85-8C3695258F17 local.sunit.TodoP2PiOS
xcrun simctl io E1877D46-004A-4FBD-BE85-8C3695258F17 screenshot \
  /private/tmp/todo-p2p-step05-ios-screen.png
```

Build/destination logs are /private/tmp/todo-p2p-step05-completion-{build,destinations}.log.
The inspected screenshot is also retained locally in ignored
DerivedData/Step05/Verification/ios-blank-screen.png. No generated output is
tracked. The standalone Simulator desktop app is absent at
/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app:
`open` returned `The file ... does not exist.` CUA app lookup also failed.
The computer-use skill's `orca` command returned `command not found` (exit 127).
Used `simctl io screenshot` and direct image inspection instead; no desktop
Simulator window was claimed. Simulator services and rendered display work.

No app/project/package source, dependency pin, signing account, certificate or
provisioning changes were needed. Manifest and package-resolution SHA-256 values
still match the earlier build evidence. The prior successful Mac regression
result remains applicable because this follow-up changes documentation only.
Physical-phone access, provisioning and device installation remain unverified.
No commits or publishing were performed in this launch-verification follow-up.
