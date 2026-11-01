// swift-tools-version: 6.4

import PackageDescription

let package = Package(
    name: "TodoP2PCore",
    platforms: [
        .macOS("27.0"),
        .iOS("27.0")
    ],
    products: [
        .library(name: "TodoP2PCore", targets: ["TodoP2PCore"])
    ],
    dependencies: [
        .package(url: "https://github.com/automerge/automerge-swift", exact: "0.7.2")
    ],
    targets: [
        .target(
            name: "TodoP2PCore",
            dependencies: [.product(name: "Automerge", package: "automerge-swift")]
        ),
        .testTarget(
            name: "TodoP2PCoreTests",
            dependencies: [
                "TodoP2PCore",
                .product(name: "Automerge", package: "automerge-swift")
            ]
        )
    ],
    swiftLanguageModes: [.v6]
)
