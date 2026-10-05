//
// FileProviderItem.swift
// Nulla FileProvider Extension
// Dataless Cloud Placeholder Engine (0 Bytes on Mac SSD)
//

import FileProvider
import UniformTypeIdentifiers

public final class FileProviderItem: NSObject, NSFileProviderItem {
    public let itemIdentifier: NSFileProviderItemIdentifier
    public let parentItemIdentifier: NSFileProviderItemIdentifier
    public let filename: String
    public let contentType: UTType
    public let isFolder: Bool
    public let sizeInBytes: Int64
    public let chunkCount: Int
    public let isLocallyCached: Bool
    public let createdAt: Date
    public let modifiedAt: Date
    
    public init(
        identifier: String,
        parentIdentifier: String? = nil,
        filename: String,
        isFolder: Bool,
        sizeInBytes: Int64 = 0,
        chunkCount: Int = 0,
        isLocallyCached: Bool = false,
        contentType: UTType? = nil,
        createdAt: Date = Date(),
        modifiedAt: Date = Date()
    ) {
        self.itemIdentifier = NSFileProviderItemIdentifier(identifier)
        self.parentItemIdentifier = parentIdentifier != nil
            ? NSFileProviderItemIdentifier(parentIdentifier!)
            : .rootContainer
        self.filename = filename
        self.isFolder = isFolder
        self.sizeInBytes = sizeInBytes
        self.chunkCount = chunkCount
        self.isLocallyCached = isLocallyCached
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        
        if isFolder {
            self.contentType = .folder
        } else if let explicitType = contentType {
            self.contentType = explicitType
        } else {
            let ext = (filename as NSString).pathExtension
            self.contentType = UTType(filenameExtension: ext) ?? .data
        }
        
        super.init()
    }
    
    // MARK: - NSFileProviderItem Protocol
    
    public var capabilities: NSFileProviderItemCapabilities {
        if isFolder {
            return [.allowsReading, .allowsAddingSubItems, .allowsContentEnumerating, .allowsRenaming, .allowsDeleting]
        }
        return [.allowsReading, .allowsWriting, .allowsRenaming, .allowsDeleting]
    }
    
    /// Reports full logical size (e.g. 48.2 GB) to Finder and video editors.
    public var documentSize: NSNumber? {
        if isFolder { return nil }
        return NSNumber(value: sizeInBytes)
    }
    
    /// Dataless Cloud Placeholder:
    /// When `false`, macOS allocates 0 physical bytes on the APFS volume.
    public var isDownloaded: Bool {
        return isLocallyCached
    }
    
    public var isMostRecentVersionDownloaded: Bool {
        return isLocallyCached
    }
    
    public var isUploaded: Bool {
        return true
    }
    
    public var isUploading: Bool {
        return false
    }
    
    public var creationDate: Date? {
        return createdAt
    }
    
    public var contentModificationDate: Date? {
        return modifiedAt
    }
    
    public var childItemCount: NSNumber? {
        if isFolder { return NSNumber(value: 0) }
        return nil
    }
}
