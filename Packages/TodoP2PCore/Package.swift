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
    targets: [
        .target(name: "TodoP2PCore")
    ],
    swiftLanguageModes: [.v6]
)
