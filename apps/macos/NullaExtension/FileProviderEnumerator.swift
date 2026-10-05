//
// FileProviderEnumerator.swift
// Nulla FileProvider Extension
// Encrypted Directory Tree Synchronizer
//

import FileProvider
import CryptoKit
import NullaShared
import os.log
import UniformTypeIdentifiers

public final class FileProviderEnumerator: NSObject, NSFileProviderEnumerator {
    private let enumeratedItemIdentifier: NSFileProviderItemIdentifier
    private let masterKey: SymmetricKey
    private let apiToken: String
    private let apiBaseURL: URL
    private let logger = Logger(subsystem: "app.nulla.macos", category: "Enumerator")
    
    private func readCredentialsFile() -> (token: String?, host: String?, masterKeyB64: String?) {
        if let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.app.nulla.macos") {
            let credsURL = groupURL.appendingPathComponent("credentials.json")
            if let data = try? Data(contentsOf: credsURL),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                return (json["token"], json["apiHost"], json["masterKeyB64"])
            }
        }
        let pw = getpwuid(getuid())
        let realHome = (pw != nil && pw!.pointee.pw_dir != nil)
            ? String(cString: pw!.pointee.pw_dir)
            : "/Users/\(NSUserName())"
        let directURL = URL(fileURLWithPath: "\(realHome)/Library/Group Containers/group.app.nulla.macos/credentials.json")
        if let data = try? Data(contentsOf: directURL),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            return (json["token"], json["apiHost"], json["masterKeyB64"])
        }
        return (nil, nil, nil)
    }
    
    private var effectiveToken: String {
        if !apiToken.isEmpty { return apiToken }
        let (fileToken, _, _) = readCredentialsFile()
        if let ft = fileToken, !ft.isEmpty { return ft }
        if let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos"),
           let token = sharedDefaults.string(forKey: "nulla_api_token"),
           !token.isEmpty {
            return token
        }
        return ""
    }
    
    private var effectiveMasterKey: SymmetricKey {
        let (_, _, fileKeyB64) = readCredentialsFile()
        if let keyB64 = fileKeyB64, let keyData = Data(base64Encoded: keyB64) {
            return SymmetricKey(data: keyData)
        }
        if let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos"),
           let keyB64 = sharedDefaults.string(forKey: "nulla_master_key_b64"),
           let keyData = Data(base64Encoded: keyB64) {
            return SymmetricKey(data: keyData)
        }
        return masterKey
    }
    
    private var effectiveBaseURL: URL {
        let (_, fileHost, _) = readCredentialsFile()
        if let host = fileHost, let url = URL(string: host) {
            return url
        }
        return apiBaseURL
    }
    
    public init(
        enumeratedItemIdentifier: NSFileProviderItemIdentifier,
        masterKey: SymmetricKey,
        apiToken: String,
        apiBaseURL: URL = URL(string: "https://nulla-worker.nulla-vault.workers.dev")!
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
        let token = effectiveToken
        let key = effectiveMasterKey
        
        // Handle unauthenticated state gracefully without throwing or hanging
        if token.isEmpty {
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
                var urlComponents = URLComponents(url: effectiveBaseURL.appendingPathComponent("api/nodes"), resolvingAgainstBaseURL: false)!
                var queryItems: [URLQueryItem] = []
                if let pid = parentId {
                    queryItems.append(URLQueryItem(name: "parent_id", value: pid))
                } else {
                    queryItems.append(URLQueryItem(name: "root_only", value: "true"))
                }
                urlComponents.queryItems = queryItems
                
                guard let requestURL = urlComponents.url else {
                    observer.didEnumerate([])
                    observer.finishEnumerating(upTo: nil)
                    return
                }
                
                var request = URLRequest(url: requestURL)
                request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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
                    var resolvedName = rawNode.name ?? ""
                    if resolvedName.isEmpty {
                        if let enc = rawNode.name_encrypted, !enc.isEmpty,
                           let iv = rawNode.name_iv, !iv.isEmpty {
                            do {
                                resolvedName = try CryptoKitEngine.shared.decryptMetadata(
                                    ciphertextBase64: enc,
                                    ivHex: iv,
                                    masterKey: key
                                )
                            } catch {
                                logger.error("Failed to decrypt node \(rawNode.id): \(error.localizedDescription)")
                                resolvedName = "Encrypted_\(rawNode.id.prefix(8))"
                            }
                        } else {
                            resolvedName = "File_\(rawNode.id.prefix(8))"
                        }
                    }
                    
                    var itemType: UTType = .data
                    if rawNode.type == "folder" {
                        itemType = .folder
                    } else if let mime = rawNode.mime_type, let ut = UTType(mimeType: mime) {
                        itemType = ut
                    } else {
                        let ext = (resolvedName as NSString).pathExtension
                        itemType = UTType(filenameExtension: ext) ?? .data
                    }
                    
                    let item = FileProviderItem(
                        identifier: rawNode.id,
                        parentIdentifier: rawNode.parent_id,
                        filename: resolvedName,
                        isFolder: rawNode.type == "folder",
                        sizeInBytes: rawNode.size_bytes,
                        chunkCount: rawNode.chunk_count ?? 1,
                        isLocallyCached: false,
                        contentType: itemType
                    )
                    
                    items.append(item)
                }
                
                logger.info("Enumerated \(items.count) items for container \(parentId ?? "root")")
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

public struct RawNodePayload: Decodable {
    public let id: String
    public let parent_id: String?
    public let name: String?
    public let name_encrypted: String?
    public let name_iv: String?
    public let type: String
    public let size_bytes: Int64
    public let chunk_count: Int?
    public let status: String?
    public let mime_type: String?
}
