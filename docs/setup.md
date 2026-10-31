# Development environment

Observed: 2026-10-31. Roadmap step 01 inventory only; no application build,
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
[decision 0002](decisions/0002-automerge-dependency-selection.md). No source, manifests, projects,
dependencies or placeholders were added; no builds, tests, commits or publishing
were performed. See `Detailed Roadmap` in the Todo P2P Obsidian vault for the next separately
scoped step.
