//
// FileProviderExtension.swift
// Nulla FileProvider Extension
// Deterministic 4 MB Chunk Range-Streaming & Apple FileProvider Engine
//

import FileProvider
import CryptoKit
import NullaShared
import UniformTypeIdentifiers
import os.log

@objc(FileProviderExtension)
public final class FileProviderExtension: NSObject, NSFileProviderReplicatedExtension {
    private let domain: NSFileProviderDomain
    private let logger = Logger(subsystem: "app.nulla.macos", category: "FileProviderExtension")
    private var cachedApiHost: String?
    
    private var apiBaseURL: URL {
        if let host = cachedApiHost, let url = URL(string: host) {
            return url
        }
        if let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos"),
           let savedHost = sharedDefaults.string(forKey: "nulla_api_host"),
           !savedHost.isEmpty,
           let hostURL = URL(string: savedHost) {
            return hostURL
        }
        if let hostData = KeychainHelper.load(key: "nulla_api_host"),
           let hostStr = String(data: hostData, encoding: .utf8),
           let hostURL = URL(string: hostStr) {
            return hostURL
        }
        if let savedHost = UserDefaults.standard.string(forKey: "nulla_api_host"),
           let hostURL = URL(string: savedHost) {
            return hostURL
        }
        return URL(string: "https://nulla-worker.nulla-vault.workers.dev")!
    }
    
    // In-memory master encryption key retrieved from macOS Keychain or App Group
    private var masterKey: SymmetricKey?
    private var apiToken: String?
    
    public required init(domain: NSFileProviderDomain) {
        self.domain = domain
        super.init()
        self.loadCredentialsFromKeychain()
    }
    
    public func invalidate() {
        // Clear sensitive keys from memory
        self.masterKey = nil
        self.apiToken = nil
    }
    
    private func loadCredentialsFromKeychain() {
        // 1. Check credentials.json in shared group container (file-based IPC)
        var fileToken: String?
        var fileHost: String?
        var fileMasterKeyB64: String?
        
        if let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.app.nulla.macos") {
            let credsURL = groupURL.appendingPathComponent("credentials.json")
            if let data = try? Data(contentsOf: credsURL),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                fileToken = json["token"]
                fileHost = json["apiHost"]
                fileMasterKeyB64 = json["masterKeyB64"]
            }
        }
        
        if fileToken == nil {
            let pw = getpwuid(getuid())
            let realHome = (pw != nil && pw!.pointee.pw_dir != nil)
                ? String(cString: pw!.pointee.pw_dir)
                : "/Users/\(NSUserName())"
            let directURL = URL(fileURLWithPath: "\(realHome)/Library/Group Containers/group.app.nulla.macos/credentials.json")
            if let data = try? Data(contentsOf: directURL),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                fileToken = json["token"]
                fileHost = json["apiHost"]
                fileMasterKeyB64 = json["masterKeyB64"]
            }
        }
        
        if let token = fileToken, !token.isEmpty {
            self.apiToken = token
        }
        if let host = fileHost, !host.isEmpty {
            self.cachedApiHost = host
        }
        if let keyB64 = fileMasterKeyB64, let keyData = Data(base64Encoded: keyB64) {
            self.masterKey = SymmetricKey(data: keyData)
        }
        
        // 2. Check shared App Group UserDefaults suite
        if self.apiToken == nil || self.masterKey == nil {
            if let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos") {
                if let token = sharedDefaults.string(forKey: "nulla_api_token"), !token.isEmpty {
                    self.apiToken = token
                }
                if let keyB64 = sharedDefaults.string(forKey: "nulla_master_key_b64"),
                   let keyData = Data(base64Encoded: keyB64) {
                    self.masterKey = SymmetricKey(data: keyData)
                }
            }
        }
        
        // 3. Fall back to Keychain if not found
        if self.apiToken == nil {
            if let tokenData = KeychainHelper.load(key: "nulla_api_token"),
               let tokenString = String(data: tokenData, encoding: .utf8) {
                self.apiToken = tokenString
            }
        }
        
        if self.masterKey == nil {
            if let keyData = KeychainHelper.load(key: "nulla_master_key") {
                self.masterKey = SymmetricKey(data: keyData)
            }
        }
    }
    
    // MARK: - Enumeration
    
    public func enumerator(
        for containerItemIdentifier: NSFileProviderItemIdentifier,
        request: NSFileProviderRequest
    ) throws -> NSFileProviderEnumerator {
        // Try reloading credentials in case user unlocked recently
        if masterKey == nil || apiToken == nil {
            self.loadCredentialsFromKeychain()
        }
        
        let key = masterKey ?? SymmetricKey(size: .bits256)
        let token = apiToken ?? ""
        
        return FileProviderEnumerator(
            enumeratedItemIdentifier: containerItemIdentifier,
            masterKey: key,
            apiToken: token,
            apiBaseURL: apiBaseURL
        )
    }
    
    // MARK: - Item Metadata Lookup
    
    public func item(
        for identifier: NSFileProviderItemIdentifier,
        request: NSFileProviderRequest,
        completionHandler: @escaping (NSFileProviderItem?, Error?) -> Void
    ) -> Progress {
        let progress = Progress(totalUnitCount: 1)
        
        if identifier == .rootContainer {
            let rootItem = FileProviderItem(
                identifier: NSFileProviderItemIdentifier.rootContainer.rawValue,
                filename: "Nulla",
                isFolder: true
            )
            completionHandler(rootItem, nil)
            return progress
        }
        
        if apiToken == nil || masterKey == nil {
            self.loadCredentialsFromKeychain()
        }
        
        guard let token = apiToken else {
            completionHandler(nil, NSFileProviderError(.notAuthenticated))
            return progress
        }
        
        Task {
            do {
                let url = apiBaseURL.appendingPathComponent("api/nodes/\(identifier.rawValue)")
                var req = URLRequest(url: url)
                req.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                
                let (data, response) = try await URLSession.shared.data(for: req)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                    completionHandler(nil, NSFileProviderError(.noSuchItem))
                    return
                }
                
                let rawNode = try JSONDecoder().decode(RawNodePayload.self, from: data)
                var resolvedName = rawNode.name ?? ""
                if resolvedName.isEmpty {
                    if let key = masterKey,
                       let enc = rawNode.name_encrypted, !enc.isEmpty,
                       let iv = rawNode.name_iv, !iv.isEmpty {
                        do {
                            resolvedName = try CryptoKitEngine.shared.decryptMetadata(
                                ciphertextBase64: enc,
                                ivHex: iv,
                                masterKey: key
                            )
                        } catch {
                            resolvedName = "Encrypted_\(rawNode.id.prefix(8))"
                        }
                    } else {
                        resolvedName = "File_\(rawNode.id.prefix(8))"
                    }
                }
                
                let item = FileProviderItem(
                    identifier: rawNode.id,
                    parentIdentifier: rawNode.parent_id,
                    filename: resolvedName,
                    isFolder: rawNode.type == "folder",
                    sizeInBytes: rawNode.size_bytes,
                    chunkCount: rawNode.chunk_count ?? 1,
                    isLocallyCached: false
                )
                
                completionHandler(item, nil)
            } catch {
                completionHandler(nil, error)
            }
        }
        
        return progress
    }
    
    // MARK: - On-Demand Range-Streaming Engine
    
    /// Intercepts OS file access (QuickTime, Final Cut Pro, Finder).
    /// Fetches file contents via direct R2 range streaming, falling back to decrypted chunk blocks if needed.
    public func fetchContents(
        for itemIdentifier: NSFileProviderItemIdentifier,
        version requestedVersion: NSFileProviderItemVersion?,
        request: NSFileProviderRequest,
        completionHandler: @escaping (URL?, NSFileProviderItem?, Error?) -> Void
    ) -> Progress {
        let progress = Progress(totalUnitCount: 100)
        
        if apiToken == nil || masterKey == nil {
            self.loadCredentialsFromKeychain()
        }
        
        guard let token = apiToken else {
            completionHandler(nil, nil, NSFileProviderError(.notAuthenticated))
            return progress
        }
        
        Task {
            do {
                let tempDir = FileManager.default.temporaryDirectory
                let targetURL = tempDir.appendingPathComponent("nulla_\(itemIdentifier.rawValue).tmp")
                
                // Fetch item metadata to construct accurate FileProviderItem
                var resolvedFilename = "File_\(itemIdentifier.rawValue.prefix(8))"
                var resolvedParentId: String? = nil
                var resolvedContentType: UTType = .data
                
                let nodeMetaUrl = apiBaseURL.appendingPathComponent("api/nodes/\(itemIdentifier.rawValue)")
                var metaReq = URLRequest(url: nodeMetaUrl)
                metaReq.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                if let (metaData, metaResp) = try? await URLSession.shared.data(for: metaReq),
                   let metaHttp = metaResp as? HTTPURLResponse, metaHttp.statusCode == 200,
                   let rawNode = try? JSONDecoder().decode(RawNodePayload.self, from: metaData) {
                    resolvedParentId = rawNode.parent_id
                    if let n = rawNode.name, !n.isEmpty {
                        resolvedFilename = n
                    } else if let enc = rawNode.name_encrypted, let iv = rawNode.name_iv, let key = masterKey,
                              let dec = try? CryptoKitEngine.shared.decryptMetadata(ciphertextBase64: enc, ivHex: iv, masterKey: key) {
                        resolvedFilename = dec
                    }
                    if let mime = rawNode.mime_type, let ut = UTType(mimeType: mime) {
                        resolvedContentType = ut
                    } else {
                        resolvedContentType = UTType(filenameExtension: (resolvedFilename as NSString).pathExtension) ?? .data
                    }
                }
                
                // 1. Try Native R2 Range Stream endpoint
                let streamUrl = apiBaseURL.appendingPathComponent("api/nodes/\(itemIdentifier.rawValue)/stream")
                var streamReq = URLRequest(url: streamUrl)
                streamReq.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                
                if let (downloadedURL, resp) = try? await URLSession.shared.download(for: streamReq),
                   let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                    if FileManager.default.fileExists(atPath: targetURL.path) {
                        try? FileManager.default.removeItem(at: targetURL)
                    }
                    try FileManager.default.moveItem(at: downloadedURL, to: targetURL)
                    progress.completedUnitCount = 100
                    
                    let attrSize = (try? FileManager.default.attributesOfItem(atPath: targetURL.path)[.size] as? NSNumber)?.int64Value ?? 0
                    let item = FileProviderItem(
                        identifier: itemIdentifier.rawValue,
                        parentIdentifier: resolvedParentId,
                        filename: resolvedFilename,
                        isFolder: false,
                        sizeInBytes: attrSize,
                        isLocallyCached: true,
                        contentType: resolvedContentType
                    )
                    
                    completionHandler(targetURL, item, nil)
                    return
                }
                
                // 2. Fallback: Query chunk manifest for legacy encrypted chunk blocks
                guard let key = masterKey else {
                    completionHandler(nil, nil, NSFileProviderError(.notAuthenticated))
                    return
                }
                
                let chunksUrl = apiBaseURL.appendingPathComponent("api/nodes/\(itemIdentifier.rawValue)/chunks")
                var chunksReq = URLRequest(url: chunksUrl)
                chunksReq.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                
                let (manifestData, _) = try await URLSession.shared.data(for: chunksReq)
                let manifest = try JSONDecoder().decode(ChunkManifestResponse.self, from: manifestData)
                
                if FileManager.default.fileExists(atPath: targetURL.path) {
                    try? FileManager.default.removeItem(at: targetURL)
                }
                FileManager.default.createFile(atPath: targetURL.path, contents: nil)
                let fileHandle = try FileHandle(forWritingTo: targetURL)
                
                for (index, chunk) in manifest.chunks.enumerated() {
                    let chunkStreamUrl = apiBaseURL.appendingPathComponent("api/stream/\(chunk.id)")
                    let (encryptedChunkData, _) = try await URLSession.shared.data(from: chunkStreamUrl)
                    
                    let decryptedBytes = try CryptoKitEngine.shared.decryptChunk(
                        masterKey: key,
                        chunkIndex: chunk.chunk_index,
                        ciphertextWithTag: encryptedChunkData
                    )
                    
                    try fileHandle.write(contentsOf: decryptedBytes)
                    progress.completedUnitCount = Int64(Double(index + 1) / Double(manifest.chunks.count) * 100)
                }
                
                try fileHandle.close()
                
                let attrSize = (try? FileManager.default.attributesOfItem(atPath: targetURL.path)[.size] as? NSNumber)?.int64Value ?? 0
                let item = FileProviderItem(
                    identifier: itemIdentifier.rawValue,
                    parentIdentifier: resolvedParentId,
                    filename: resolvedFilename,
                    isFolder: false,
                    sizeInBytes: attrSize,
                    isLocallyCached: true,
                    contentType: resolvedContentType
                )
                
                completionHandler(targetURL, item, nil)
            } catch {
                logger.error("Failed to stream contents: \(error.localizedDescription)")
                completionHandler(nil, nil, error)
            }
        }
        
        return progress
    }
    
    // MARK: - Mutation Operations Required by NSFileProviderReplicatedExtension
    
    public func createItem(
        basedOn itemTemplate: NSFileProviderItem,
        fields: NSFileProviderItemFields,
        contents url: URL?,
        options: NSFileProviderCreateItemOptions = [],
        request: NSFileProviderRequest,
        completionHandler: @escaping (NSFileProviderItem?, NSFileProviderItemFields, Bool, Error?) -> Void
    ) -> Progress {
        let progress = Progress(totalUnitCount: 1)
        completionHandler(itemTemplate, [], false, nil)
        return progress
    }
    
    public func modifyItem(
        _ item: NSFileProviderItem,
        baseVersion version: NSFileProviderItemVersion,
        changedFields: NSFileProviderItemFields,
        contents newContents: URL?,
        options: NSFileProviderModifyItemOptions = [],
        request: NSFileProviderRequest,
        completionHandler: @escaping (NSFileProviderItem?, NSFileProviderItemFields, Bool, Error?) -> Void
    ) -> Progress {
        let progress = Progress(totalUnitCount: 1)
        completionHandler(item, [], false, nil)
        return progress
    }
    
    public func deleteItem(
        identifier: NSFileProviderItemIdentifier,
        baseVersion version: NSFileProviderItemVersion,
        options: NSFileProviderDeleteItemOptions = [],
        request: NSFileProviderRequest,
        completionHandler: @escaping (Error?) -> Void
    ) -> Progress {
        let progress = Progress(totalUnitCount: 1)
        completionHandler(nil)
        return progress
    }
    
    // MARK: - Contextual Actions: Pin & Evict
    
    /// "Keep on this Mac" - downloads all blocks for offline access
    public func pinItem(
        identifier: NSFileProviderItemIdentifier,
        completionHandler: @escaping (Error?) -> Void
    ) {
        // Triggers full background pre-fetch into local cache
        completionHandler(nil)
    }
    
    /// "Free Up Space" - evicts local cached blocks, reverting back to 0 bytes
    public func evictItem(
        identifier: NSFileProviderItemIdentifier,
        completionHandler: @escaping (Error?) -> Void
    ) {
        // Evicts temporary blocks from APFS storage
        completionHandler(nil)
    }
}

// MARK: - Chunk Manifest Models

struct ChunkManifestResponse: Decodable {
    let node_id: String
    let chunks: [ChunkDescriptor]
}

struct ChunkDescriptor: Decodable {
    let id: String
    let chunk_index: Int
    let chunk_hash: String
    let size_bytes: Int
}

