# 0002: Automerge dependency selection

Inspection date: 2026-10-31.

Status: selected from source evidence for roadmap step 02; integration unverified.
This is a source-based compatibility decision, not a successful resolution or build.
The sole implementation checklist is `Detailed Roadmap` in the Todo P2P vault.

## Decision and candidate comparison

Select core **0.7.2** and wrapper **0.3.2** for later integration. Their declared
requirements fit the observed Xcode 27.1 / Apple Swift 6.4 environment in
[setup](../setup.md). Prefer the newest inspected release with matching artifact
metadata; do not infer API compatibility from the version constraint alone.

| Candidate | Tag and full commit SHA | Tools / language | Declared macOS / iOS minimum | Outcome |
| --- | --- | --- | --- | --- |
| Core, selected | `0.7.2` — `aa45d17ac92cef2b8ded63b47e65a28dc85e3418` | 5.9 tools; default Swift 5 mode | 10.15 / 13 | Newest returned core tag; required artifact slices present |
| Core, alternative | `0.6.1` — `cdbdce07bb3e21809cbb801402ef45114a5dd584` | 5.9 tools; default Swift 5 mode | 10.15 / 13 | Also constraint-compatible; no demonstrated benefit over 0.7.2 |
| Wrapper, both pairs | `0.3.2` — `cdeb8053c3aa2510189429d717ab09e70f134716` | 5.9 tools; default Swift 5 mode with feature flags | 13 / 16 | Newest returned wrapper tag; selected |

The wrapper declares `.upToNextMajor(from: "0.5.7")`, meaning `>=0.5.7, <1.0.0`.
Both proposed core tags satisfy that explicit range, including across minor
versions below 1.0. Both packages omit an explicit language-version override.
The wrapper enables `StrictConcurrency`, `ExistentialAny`, `AccessLevelOnImport`
and `InternalImportsByDefault`; its 5.9 tools header alone does not prove that
those flags work on every 5.9 compiler. The selected compiler is newer, but actual
acceptance remains a build check. Core enables additional concurrency checks and
a local artifact path when `LOCAL_BUILD` is set; leave that variable unset for
normal release consumption. No Rust toolchain is required for this intended path.

Pinned sources: core [0.7.2 manifest](https://github.com/automerge/automerge-swift/blob/aa45d17ac92cef2b8ded63b47e65a28dc85e3418/Package.swift),
[0.6.1 manifest](https://github.com/automerge/automerge-swift/blob/cdbdce07bb3e21809cbb801402ef45114a5dd584/Package.swift),
wrapper [manifest](https://github.com/automerge/automerge-repo-swift/blob/cdeb8053c3aa2510189429d717ab09e70f134716/Package.swift).
Swift documents [tools requirements](https://docs.swift.org/package-manager/PackageDescription/PackageDescription.html)
and the distinction between [compiler version and language mode](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/compatibility/).

Future pinning: use exact version requirements for both selected tags, verify
their full SHAs above, then retain and review the generated `Package.resolved`
when resolution is authorized in the integration steps. Do not float on `main`
or substitute a different architecture if integration fails.

## Artifacts and transitive dependencies

Downloaded each release archive into memory for SHA-256 and XCFramework
`Info.plist` inspection only. Both archives match their manifest checksum:

- [0.7.2 archive](https://github.com/automerge/automerge-swift/releases/download/0.7.2/automergeFFI.xcframework.zip): `10245378e74229b026f689b039d7df3cf17aeed353706d5f420dfd164f283a86`.
- [0.6.1 archive](https://github.com/automerge/automerge-swift/releases/download/0.6.1/automergeFFI.xcframework.zip): `4bfa96eb95531c4d675281fb31c8ecb0804122a6074f963b9ad379a203318e54`.

Both declare macOS `arm64,x86_64`, iOS device `arm64` and iOS simulator
`arm64,x86_64` static-library slices. This covers the arm64 host and intended
phone/simulator architectures at the metadata level. It does not establish
linkability, Mach-O deployment minimums or execution on OS 27. Archives also
contain Catalyst and visionOS slices; those are outside this product's scope.

Wrapper direct constraints, common to both pairs: PotentCodables `>=3.1.0,<4`,
Base58Swift `>=2.1.14,<3`, AsyncAlgorithms `>=1.0.0,<2`, distributed-tracing
`>=1.0.0,<2`, and DocC plugin `>=1.0.0,<2`. DocC is documentation tooling;
Tracing is instrumentation infrastructure, not evidence of a configured network
exporter. Runtime traffic still requires the later audit.

The wrapper's [checked-in resolution](https://github.com/automerge/automerge-repo-swift/blob/cdeb8053c3aa2510189429d717ab09e70f134716/Package.resolved)
provides this inspectable transitive baseline, **not a resolution of our pair**.
It pins core 0.5.19 (`c8daf47b5cb77ae5eec451a4e4b77ad6f6db8f5e`), so it cannot
prove wrapper support for 0.7.2. The following exact revisions' manifests and
licenses were inspected; future resolution may choose newer transitive versions.

| Dependency baseline | Exact revision and manifest | Tools | License evidence |
| --- | --- | --- | --- |
| base58swift 2.1.15 | [`3ba16c02089401c817b631ffc33ca8f022a41538`](https://github.com/heckj/Base58Swift/blob/3ba16c02089401c817b631ffc33ca8f022a41538/Package.swift) | 5.0 | [MIT](https://github.com/heckj/Base58Swift/blob/3ba16c02089401c817b631ffc33ca8f022a41538/LICENSE) |
| bigint 5.3.0 | [`0ed110f7555c34ff468e72e1686e59721f2b0da6`](https://github.com/attaswift/BigInt/blob/0ed110f7555c34ff468e72e1686e59721f2b0da6/Package.swift) | 5.0 | [MIT](https://github.com/attaswift/BigInt/blob/0ed110f7555c34ff468e72e1686e59721f2b0da6/LICENSE.md) |
| float16 1.1.1 | [`936ae66adccf1c91bcaeeb9c0cddde78a13695c3`](https://github.com/SusanDoggie/Float16/blob/936ae66adccf1c91bcaeeb9c0cddde78a13695c3/Package.swift) | 5.1 | [MIT](https://github.com/SusanDoggie/Float16/blob/936ae66adccf1c91bcaeeb9c0cddde78a13695c3/LICENSE) |
| potentcodables 3.5.0 | [`660e33e84e00b9bf07bd41dd99ff800600e435e7`](https://github.com/outfoxx/PotentCodables/blob/660e33e84e00b9bf07bd41dd99ff800600e435e7/Package.swift) | 5.4 | [MIT](https://github.com/outfoxx/PotentCodables/blob/660e33e84e00b9bf07bd41dd99ff800600e435e7/LICENSE) |
| regex 2.1.1 | [`76c2b73d4281d77fc3118391877efd1bf972f515`](https://github.com/sharplet/Regex/blob/76c2b73d4281d77fc3118391877efd1bf972f515/Package.swift) | 4.2 | [MIT](https://github.com/sharplet/Regex/blob/76c2b73d4281d77fc3118391877efd1bf972f515/LICENSE.txt) |
| swift-async-algorithms 1.0.0 | [`da4e36f86544cdf733a40d59b3a2267e3a7bbf36`](https://github.com/apple/swift-async-algorithms/blob/da4e36f86544cdf733a40d59b3a2267e3a7bbf36/Package@swift-5.7.swift) | 5.6 | [Apache-2.0 with Swift runtime exception](https://github.com/apple/swift-async-algorithms/blob/da4e36f86544cdf733a40d59b3a2267e3a7bbf36/LICENSE.txt) |
| swift-collections 1.0.6 | [`d029d9d39c87bed85b1c50adee7c41795261a192`](https://github.com/apple/swift-collections/blob/d029d9d39c87bed85b1c50adee7c41795261a192/Package@swift-5.5.swift) | 5.5 | [Apache-2.0 with Swift runtime exception](https://github.com/apple/swift-collections/blob/d029d9d39c87bed85b1c50adee7c41795261a192/LICENSE.txt) |
| swift-distributed-tracing 1.1.2 | [`6483d340853a944c96dbcc28b27dd10b6c581703`](https://github.com/apple/swift-distributed-tracing/blob/6483d340853a944c96dbcc28b27dd10b6c581703/Package.swift) | 5.7 | [Apache-2.0](https://github.com/apple/swift-distributed-tracing/blob/6483d340853a944c96dbcc28b27dd10b6c581703/LICENSE.txt) |
| swift-docc-plugin 1.4.3 | [`85e4bb4e1cd62cec64a4b8e769dcefdf0c5b9d64`](https://github.com/apple/swift-docc-plugin/blob/85e4bb4e1cd62cec64a4b8e769dcefdf0c5b9d64/Package.swift) | 5.7 | [Apache-2.0 with Swift runtime exception](https://github.com/apple/swift-docc-plugin/blob/85e4bb4e1cd62cec64a4b8e769dcefdf0c5b9d64/LICENSE.txt) |
| swift-docc-symbolkit 1.0.0 | [`b45d1f2ed151d057b54504d653e0da5552844e34`](https://github.com/swiftlang/swift-docc-symbolkit/blob/b45d1f2ed151d057b54504d653e0da5552844e34/Package@swift-5.5.swift) | 5.5 | [Apache-2.0 with Swift runtime exception](https://github.com/swiftlang/swift-docc-symbolkit/blob/b45d1f2ed151d057b54504d653e0da5552844e34/LICENSE.txt) |
| swift-numerics 1.0.2 | [`0a5bc04095a675662cf24757cc0640aa2204253b`](https://github.com/apple/swift-numerics/blob/0a5bc04095a675662cf24757cc0640aa2204253b/Package.swift) | 5.0 | [Apache-2.0 with Swift runtime exception](https://github.com/apple/swift-numerics/blob/0a5bc04095a675662cf24757cc0640aa2204253b/LICENSE.txt) |
| swift-service-context 1.1.0 | [`0c62c5b4601d6c125050b5c3a97f20cce881d32b`](https://github.com/apple/swift-service-context/blob/0c62c5b4601d6c125050b5c3a97f20cce881d32b/Package.swift) | 5.7 | [Apache-2.0](https://github.com/apple/swift-service-context/blob/0c62c5b4601d6c125050b5c3a97f20cce881d32b/LICENSE.txt) |

PotentCodables declares macOS 11 / iOS 14; AsyncAlgorithms declares macOS 10.15 /
iOS 13; DocC declares host macOS 10.15.4. Other baseline packages declare no
explicit platform minimum. Version-specific manifests were inspected where
present (AsyncAlgorithms 5.7, Collections 5.5 and SymbolKit 5.5). These inspected
requirements do not exceed the wrapper's minimums. PotentCodables pulls BigInt,
Collections, Regex and conditionally Float16 on macOS; Float16 pulls Numerics.
Base58Swift also pulls BigInt; Tracing pulls ServiceContext; DocC pulls SymbolKit.
They are source targets rather than additional downloaded binary targets.
PotentCodables includes C YAML code; package licenses are not an exhaustive
vendored/Rust binary notice inventory. Retain that distribution audit for later.

Both selected projects and the alternative core have MIT licenses:
[core 0.7.2](https://github.com/automerge/automerge-swift/blob/aa45d17ac92cef2b8ded63b47e65a28dc85e3418/LICENSE),
[core 0.6.1](https://github.com/automerge/automerge-swift/blob/cdbdce07bb3e21809cbb801402ef45114a5dd584/LICENSE),
[wrapper](https://github.com/automerge/automerge-repo-swift/blob/cdeb8053c3aa2510189429d717ab09e70f134716/LICENSE).
Core's [Rust manifest](https://github.com/automerge/automerge-swift/blob/aa45d17ac92cef2b8ded63b47e65a28dc85e3418/rust/Cargo.toml)
declares automerge 0.7.2, thiserror 1.0.38 and UniFFI 0.28.2; those are build-side
inputs embodied in the released static library, not SwiftPM source dependencies.

## Product targets and tests

Choose **macOS 27.0 and iOS 27.0**, per the user's current-personal-device policy.
These are product minimums, deliberately higher than dependency minimums; do not
raise them to SDK patch/minor versions. The observed Mac runs 27.0.1. The user
reports iOS 27.0.1, while step 01's offline-device listing reports 26.5.2; preserve
both observations and recheck the connected phone before deployment.

Setup records macOS SDK 27.0 and iOS/simulator SDK 27.1. Installed simulator
runtimes are only 26.1 and 26.5 and cannot run an iOS 27 app. The user explicitly
chose iOS 27 despite this limitation. Later simulator checks need a compatible
runtime; physical deployment needs an online phone and signing/provisioning.
No runtime installation or signing change is part of this decision.

Choose **bundled Swift Testing** for future shared-package unit/integration tests.
Its [distribution documentation](https://github.com/swiftlang/swift-testing/blob/678d56407ddc93c6a9c8ef38a345de298a097b00/Documentation/Distributions.md)
identifies inclusion with Swift 6 and Xcode 16 onward and recommends the bundled
copy. Step 01's Swift 6.4 / Xcode 27.1 meets that documented requirement; OS 27
targets do not require backward test-runtime support. Apple documents
[Swift Testing in Xcode](https://developer.apple.com/xcode/swift-testing/).
Do not add a swift-testing package dependency. XCTest remains suitable for future
UI automation/performance-specific needs; it is not needed for the first document
and convergence probes. No test discovery or execution has been verified.

## Rejected alternatives and later checks

- Core 0.6.1 offers the same declared platform/architecture coverage without a
  demonstrated advantage. Wrapper 0.3.1's inspected manifest has the same direct
  requirements; prefer 0.3.2. Its SHA is `cd920483ad914c273a7f3d43c79011a16f8166c2`
  ([manifest](https://github.com/automerge/automerge-repo-swift/blob/cd920483ad914c273a7f3d43c79011a16f8166c2/Package.swift)).
- Do not copy core README's 0.5.2 example or wrapper README's 0.1.0 example. The
  wrapper's [README](https://github.com/automerge/automerge-repo-swift/blob/cdeb8053c3aa2510189429d717ab09e70f134716/README.md)
  even says no release is tagged despite actual tags, and warns about unstable
  APIs and classes incompatible with Swift 6. Swift 5 dependency language mode
  avoids assuming a migration, but does not establish compiler compatibility.
- Step 03 validates package scaffolding; steps 04/05 validate app targets.
  Steps 06/07 must resolve the actual graph, review transitive changes, compile,
  perform document round trips and construct real storage/provider APIs. Reopen
  this decision if experimental flags, changed core APIs, binary linkage or newer
  transitives fail; there is no evidence justifying a speculative patch now.
- Step 08 and later steps must establish provider TLS/discovery/path controls,
  LAN-only routing, auto-connect defaults, storage durability, security and real
  device behavior. None follows from this selection or artifact inspection.

Step 02's source-selection check is satisfied. Resolution, compilation, document
round trips, provider construction and LAN/security behavior remain unverified.
Stop before step 03.

## Reproducing the research

Research used GitHub tag API responses and raw files at full commits; no package
manager was invoked. Sandbox DNS initially failed; approved network reads worked.
An attempted Base58Swift `2.1.14` tag-ref lookup returned 404; its declared lower
bound was retained, and the wrapper's exact 2.1.15 baseline was inspected instead.
Research files stayed in `/private/tmp/todo-p2p-step02`, outside the application.
The following standalone recipe prints tag SHAs, pinned manifests/licenses,
upstream resolution, and artifact checksums/slice metadata without resolving or
building anything. Use the transitive table's pinned links to repeat those reads.

```python
import hashlib, io, json, plistlib, urllib.request, zipfile

def read(url):
    return urllib.request.urlopen(url).read()

root = "https://github.com/automerge/"
raw = "https://raw.githubusercontent.com/automerge/"
candidates = [
    ("automerge-swift", "0.7.2", "aa45d17ac92cef2b8ded63b47e65a28dc85e3418"),
    ("automerge-swift", "0.6.1", "cdbdce07bb3e21809cbb801402ef45114a5dd584"),
    ("automerge-repo-swift", "0.3.2", "cdeb8053c3aa2510189429d717ab09e70f134716"),
]
for repo, tag, sha in candidates:
    print(read(f"https://api.github.com/repos/automerge/{repo}/tags?per_page=100").decode())
    for name in ["Package.swift", "LICENSE", "README.md"]:
        print(read(f"{raw}{repo}/{sha}/{name}").decode())
    if repo == "automerge-repo-swift":
        print(read(f"{raw}{repo}/{sha}/Package.resolved").decode())
    else:
        data = read(f"{root}{repo}/releases/download/{tag}/automergeFFI.xcframework.zip")
        print(tag, hashlib.sha256(data).hexdigest())
        archive = zipfile.ZipFile(io.BytesIO(data))
        for name in archive.namelist():
            if name.endswith("xcframework/Info.plist"):
                print(plistlib.loads(archive.read(name)))
```
