// swift-tools-version: 6.4

import PackageDescription

let package = Package(
    name: "TodoP2PCore",
    platforms: [
        .macOS("27.0"),
        .iOS("27.0")
    ],
    products: [
        .library(name: "TodoP2PCore", targets: ["TodoP2PCore"]),
        .library(name: "TodoP2PApp", targets: ["TodoP2PApp"])
    ],
    dependencies: [
        .package(url: "https://github.com/automerge/automerge-swift", exact: "0.7.2"),
        .package(url: "https://github.com/automerge/automerge-repo-swift", exact: "0.3.2")
    ],
    targets: [
        .target(name: "TodoP2PApp", dependencies: ["TodoP2PCore"]),
        .testTarget(name: "TodoP2PAppTests", dependencies: ["TodoP2PApp", "TodoP2PCore"]),
        .target(
            name: "TodoP2PCore",
            dependencies: [
                .product(name: "Automerge", package: "automerge-swift"),
                .product(name: "AutomergeRepo", package: "automerge-repo-swift")
            ]
        ),
        .testTarget(
            name: "TodoP2PCoreTests",
            dependencies: [
                "TodoP2PCore",
                .product(name: "Automerge", package: "automerge-swift"),
                .product(name: "AutomergeRepo", package: "automerge-repo-swift")
            ]
        )
    ],
    swiftLanguageModes: [.v6]
)
