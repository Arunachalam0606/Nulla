//
// FileProviderEnumerator.swift
// Nulla FileProvider Extension
// Encrypted Directory Tree Synchronizer
//

import FileProvider
import CryptoKit
import NullaShared
import os.log

public final class FileProviderEnumerator: NSObject, NSFileProviderEnumerator {
    private let enumeratedItemIdentifier: NSFileProviderItemIdentifier
    private let masterKey: SymmetricKey
    private let apiToken: String
    private let apiBaseURL: URL
    private let logger = Logger(subsystem: "app.nulla.macos", category: "Enumerator")
    
    public init(
        enumeratedItemIdentifier: NSFileProviderItemIdentifier,
        masterKey: SymmetricKey,
        apiToken: String,
        apiBaseURL: URL = URL(string: "http://localhost:8787")!
    ) {
        self.enumeratedItemIdentifier = enumeratedItemIdentifier
        self.masterKey = masterKey
        self.apiToken = apiToken
        self.apiBaseURL = apiBaseURL
        super.init()
    }
    
    public func invalidate() {
        // Cleanup any pending network tasks
    }
    
    public func enumerateItems(
        for observer: NSFileProviderEnumerationObserver,
        startingAt page: NSFileProviderPage
    ) {
        // Handle unauthenticated state gracefully without throwing or hanging
        if apiToken.isEmpty {
            logger.info("Enumeration requested while unauthenticated. Returning empty root container.")
            observer.didEnumerate([])
            observer.finishEnumerating(upTo: nil)
            return
        }
        
        let parentId: String? = (enumeratedItemIdentifier == .rootContainer)
            ? nil
            : enumeratedItemIdentifier.rawValue
        
        Task {
            do {
                var urlComponents = URLComponents(url: apiBaseURL.appendingPathComponent("api/nodes"), resolvingAgainstBaseURL: false)!
                if let pid = parentId {
                    urlComponents.queryItems = [URLQueryItem(name: "parent_id", value: pid)]
                }
                
                var request = URLRequest(url: urlComponents.url!)
                request.addValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
                request.httpMethod = "GET"
                
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                    logger.warning("api/nodes non-200 HTTP response. Returning empty enumeration.")
                    observer.didEnumerate([])
                    observer.finishEnumerating(upTo: nil)
                    return
                }
                
                let decoder = JSONDecoder()
                let responsePayload = try decoder.decode(NodesResponse.self, from: data)
                
                var items: [FileProviderItem] = []
                
                for rawNode in responsePayload.nodes {
                    var decryptedName = "Encrypted_\(rawNode.id.prefix(8))"
                    do {
                        decryptedName = try CryptoKitEngine.shared.decryptMetadata(
                            ciphertextBase64: rawNode.name_encrypted,
                            ivHex: rawNode.name_iv,
                            masterKey: masterKey
                        )
                    } catch {
                        logger.error("Failed to decrypt node \(rawNode.id): \(error.localizedDescription)")
                    }
                    
                    let item = FileProviderItem(
                        identifier: rawNode.id,
                        parentIdentifier: rawNode.parent_id,
                        filename: decryptedName,
                        isFolder: rawNode.type == "folder",
                        sizeInBytes: rawNode.size_bytes,
                        chunkCount: rawNode.chunk_count,
                        isLocallyCached: false // 0 Bytes physical allocation
                    )
                    
                    items.append(item)
                }
                
                observer.didEnumerate(items)
                observer.finishEnumerating(upTo: nil)
            } catch {
                logger.error("Enumeration error: \(error.localizedDescription)")
                // For root container, return empty instead of failing so fileproviderd stays active
                if enumeratedItemIdentifier == .rootContainer {
                    observer.didEnumerate([])
                    observer.finishEnumerating(upTo: nil)
                } else {
                    observer.finishEnumeratingWithError(error)
                }
            }
        }
    }
}

// MARK: - API Decodable Models

struct NodesResponse: Decodable {
    let nodes: [RawNodePayload]
}

struct RawNodePayload: Decodable {
    let id: String
    let parent_id: String?
    let name_encrypted: String
    let name_iv: String
    let type: String
    let size_bytes: Int64
    let chunk_count: Int
    let status: String
}
