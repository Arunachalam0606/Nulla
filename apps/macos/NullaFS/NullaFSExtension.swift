//
// NullaFSExtension.swift
// Nulla macOS File System Extension (FSKit)
// "0 bytes on your Mac. Terabytes in the cloud."
//

import Foundation
import FSKit
import ExtensionFoundation

@available(macOS 15.4, *)
@main
struct NullaFSExtension: UnaryFileSystemExtension {
    typealias FileSystem = NullaFileSystem
    let fileSystem = NullaFileSystem()
}

@available(macOS 15.4, *)
final class NullaFileSystem: FSUnaryFileSystem, FSUnaryFileSystemOperations {
    func probeResource(resource: FSResource) async throws -> FSProbeResult {
        return .usable(name: "Nulla", containerID: FSContainerIdentifier(uuid: UUID()))
    }

    func loadResource(resource: FSResource, options: FSTaskOptions) async throws -> FSVolume {
        return NullaVolume(volumeID: FSVolume.Identifier(uuid: UUID()), volumeName: FSFileName(string: "Nulla"))
    }

    func unloadResource(resource: FSResource, options: FSTaskOptions) async throws {
        // Handle volume unload
    }
}

@available(macOS 15.4, *)
final class NullaVolume: FSVolume {
    override init(volumeID: FSVolume.Identifier, volumeName: FSFileName) {
        super.init(volumeID: volumeID, volumeName: volumeName)
    }
}
