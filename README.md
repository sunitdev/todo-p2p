# Todo P2P

A personal macOS and iPhone todo app being built for independent offline use and paired LAN synchronization, with no backend or cloud services.

Start either app from the repository root:

```sh
make mac
make iphone
```

`make iphone` prefers a booted iPhone Simulator, otherwise the newest available iOS 27+ iPhone. Use `make simulators` and `make iphone SIMULATOR=<UUID>` to choose one. A graphical Simulator window requires Simulator.app in the selected Xcode installation. Run `make help` for build targets and overrides.

Build and test the shared package from the repository root (`LOCAL_BUILD` must be unset):

```sh
xcrun swift build --package-path Packages/TodoP2PCore
xcrun swift test --package-path Packages/TodoP2PCore
```

Both apps share the TodoP2PApp presentation library and support local todo creation, editing, completion, deletion and save retry.

Open `TodoP2P.xcodeproj` and select `TodoP2PMac` or `TodoP2PiOS` to build and run. Command-line entry points:

```sh
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PMac -configuration Debug \
  -destination 'platform=macOS,arch=arm64' -derivedDataPath DerivedData \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build
open DerivedData/Build/Products/Debug/TodoP2PMac.app

xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData \
  ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build
```
Use Export workspace and Restore workspace for explicit local snapshots. Exports contain personal data and exclude editor drafts and pairing credentials. Choose a local destination. Restore retains the original in protected `RestoreRecovery` storage.

Simulator signing supplies an application context for Keychain tests. The ad hoc Mac build above cannot qualify secure pairing without appropriate signing entitlements.
