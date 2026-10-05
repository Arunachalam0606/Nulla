// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "NullaMacOS",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "NullaShared", targets: ["NullaShared"]),
        .executable(name: "NullaExtension", targets: ["NullaExtension"]),
        .executable(name: "NullaApp", targets: ["NullaApp"])
    ],
    targets: [
        .target(
            name: "NullaShared",
            path: "Shared"
        ),
        .executableTarget(
            name: "NullaExtension",
            dependencies: ["NullaShared"],
            path: "NullaExtension"
        ),
        .executableTarget(
            name: "NullaApp",
            dependencies: ["NullaShared"],
            path: "NullaApp"
        ),
        .testTarget(
            name: "NullaSharedTests",
            dependencies: ["NullaShared"],
            path: "Tests/NullaSharedTests"
        )
    ]
)
