# Todo P2P

A personal macOS and iPhone todo app being built for independent offline use and paired LAN synchronization, with no backend or cloud services.

Build and test the shared package from the repository root (`LOCAL_BUILD` must be unset):

```sh
xcrun swift build --package-path Packages/TodoP2PCore
xcrun swift test --package-path Packages/TodoP2PCore
```

Open `TodoP2P.xcodeproj` and select `TodoP2PMac` or `TodoP2PiOS` to build and run. Command-line entry points:

```sh
xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PMac -configuration Debug \
  -destination 'platform=macOS,arch=arm64' -derivedDataPath DerivedData \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build
open DerivedData/Build/Products/Debug/TodoP2PMac.app

xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData \
  CODE_SIGNING_ALLOWED=NO build
```

Detailed documentation lives in the **Todo P2P Obsidian vault**, starting at `Todo P2P.md`:

`/Users/sunit/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal/Freelance/Personal/Projects/Todo P2P`
