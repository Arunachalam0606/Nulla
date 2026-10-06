//
// VaultService.swift
// Nulla macOS Client
// Live Storage Telemetry, Chunk Upload Pipeline, & Encrypted Search
//

import Foundation
import Combine
import CryptoKit
import FileProvider
import UniformTypeIdentifiers
import NullaShared

public final class VaultService: ObservableObject, @unchecked Sendable {
    public static let shared = VaultService()
    
    @Published public var isAuthenticated: Bool = false
    @Published public var cloudStorageUsed: String = "0 bytes"
    @Published public var localDiskUsed: String = "0 bytes"
    @Published public var isUploading: Bool = false
    @Published public var uploadProgress: Double = 0.0
    @Published public var currentUploadFileName: String = ""
    @Published public var errorMessage: String? = nil
    @Published public var nodes: [VaultNodeItem] = []
    @Published public var userStorageQuotaBytes: Int64 = 5_368_709_120 // 5 GB Default
    @Published public var userStorageUsedBytes: Int64 = 0
    
    public var apiBaseURL: URL {
        if let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos"),
           let savedHost = sharedDefaults.string(forKey: "nulla_api_host"),
           !savedHost.isEmpty,
           let url = URL(string: savedHost) {
            return url
        }
        if let savedHost = UserDefaults.standard.string(forKey: "nulla_api_host"),
           !savedHost.isEmpty,
           let url = URL(string: savedHost) {
            return url
        }
        if let customUrl = ProcessInfo.processInfo.environment["NULLA_API_URL"],
           !customUrl.isEmpty,
           let url = URL(string: customUrl) {
            return url
        }
        return URL(string: "https://nulla-worker.nulla-vault.workers.dev")!
    }
    
    private init() {
        self.isAuthenticated = (getAuthToken() != nil && getMasterKey() != nil)
    }
    
    // MARK: - Credentials
    
    public func getAuthToken() -> String? {
        if let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos"),
           let token = sharedDefaults.string(forKey: "nulla_api_token"),
           !token.isEmpty {
            return token
        }
        if let tokenData = KeychainHelper.load(key: "nulla_api_token"),
           let token = String(data: tokenData, encoding: .utf8) {
            return token
        }
        return ProcessInfo.processInfo.environment["NULLA_AUTH_TOKEN"]
    }
    
    public func getMasterKey() -> SymmetricKey? {
        if let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos"),
           let keyB64 = sharedDefaults.string(forKey: "nulla_master_key_b64"),
           let keyData = Data(base64Encoded: keyB64) {
            return SymmetricKey(data: keyData)
        }
        if let keyData = KeychainHelper.load(key: "nulla_master_key") {
            return SymmetricKey(data: keyData)
        }
        if let hexKey = ProcessInfo.processInfo.environment["NULLA_MASTER_KEY"],
           let keyData = Data(hexString: hexKey) {
            return SymmetricKey(data: keyData)
        }
        return nil
    }
    
    // MARK: - Authentication & Vault Unlock
    
    @MainActor
    public func login(email: String, password: String, apiHost: String) async throws {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let cleanHost = apiHost.trimmingCharacters(in: .whitespacesAndNewlines)
        
        UserDefaults.standard.set(cleanHost, forKey: "nulla_api_host")
        guard let baseURL = URL(string: cleanHost) else {
            throw NSError(domain: "NullaAuth", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid API host URL"])
        }
        
        // 1. Query user salt
        var saltComponents = URLComponents(url: baseURL.appendingPathComponent("api/auth/salt"), resolvingAgainstBaseURL: false)!
        saltComponents.queryItems = [URLQueryItem(name: "email", value: cleanEmail)]
        
        var saltReq = URLRequest(url: saltComponents.url!)
        saltReq.httpMethod = "GET"
        
        let (saltData, saltResp) = try await URLSession.shared.data(for: saltReq)
        guard let saltHttp = saltResp as? HTTPURLResponse, (200...299).contains(saltHttp.statusCode) else {
            throw NSError(domain: "NullaAuth", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to connect to authentication server."])
        }
        
        let saltResult = try JSONDecoder().decode(SaltQueryResponse.self, from: saltData)
        let salt = saltResult.salt
        
        // 2. Derive 256-bit Master Key and Server Auth Key via PBKDF2 (100k rounds)
        let (masterKey, serverAuthKeyHex) = try CryptoKitEngine.shared.deriveKey(password: password, salt: salt)
        
        let deviceName = Host.current().localizedName ?? "Mac Client"
        
        if saltResult.registered == false {
            // Auto-register zero-knowledge vault
            let regUrl = baseURL.appendingPathComponent("api/auth/register")
            var regReq = URLRequest(url: regUrl)
            regReq.httpMethod = "POST"
            regReq.addValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let regPayload: [String: Any] = [
                "email": cleanEmail,
                "salt": salt,
                "server_auth_key": serverAuthKeyHex,
                "device_name": deviceName,
                "device_type": "mac"
            ]
            regReq.httpBody = try JSONSerialization.data(withJSONObject: regPayload)
            
            let (regData, regResp) = try await URLSession.shared.data(for: regReq)
            guard let regHttp = regResp as? HTTPURLResponse, (200...299).contains(regHttp.statusCode) else {
                throw NSError(domain: "NullaAuth", code: 4, userInfo: [NSLocalizedDescriptionKey: "Account registration failed."])
            }
            
            try handleAuthSuccess(data: regData, masterKey: masterKey)
            return
        }
        
        // 3. Authenticate with server
        let loginUrl = baseURL.appendingPathComponent("api/auth/login")
        var loginReq = URLRequest(url: loginUrl)
        loginReq.httpMethod = "POST"
        loginReq.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let loginPayload: [String: Any] = [
            "email": cleanEmail,
            "server_auth_key": serverAuthKeyHex,
            "device_name": deviceName,
            "device_type": "mac"
        ]
        loginReq.httpBody = try JSONSerialization.data(withJSONObject: loginPayload)
        
        let (loginData, loginResp) = try await URLSession.shared.data(for: loginReq)
        guard let loginHttp = loginResp as? HTTPURLResponse else {
            throw NSError(domain: "NullaAuth", code: 3, userInfo: [NSLocalizedDescriptionKey: "Network response error."])
        }
        
        guard (200...299).contains(loginHttp.statusCode) else {
            throw NSError(domain: "NullaAuth", code: 5, userInfo: [NSLocalizedDescriptionKey: "Invalid email or password."])
        }
        
        try handleAuthSuccess(data: loginData, masterKey: masterKey)
    }
    
    @MainActor
    private func handleAuthSuccess(data: Data, masterKey: SymmetricKey) throws {
        let result = try JSONDecoder().decode(LoginSuccessResponse.self, from: data)
        let token = result.token
        let userId = result.user?.id ?? ""
        let apiHost = apiBaseURL.absoluteString
        
        // 1. Store session token, 256-bit Master Key, and API host securely in Apple Keychain
        KeychainHelper.save(key: "nulla_api_token", data: Data(token.utf8))
        let masterKeyData = masterKey.withUnsafeBytes { Data($0) }
        KeychainHelper.save(key: "nulla_master_key", data: masterKeyData)
        if let hostData = apiHost.data(using: .utf8) {
            KeychainHelper.save(key: "nulla_api_host", data: hostData)
        }
        
        // 2. Share credentials to FileProvider extension via App Group
        let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos")
        sharedDefaults?.set(token, forKey: "nulla_api_token")
        sharedDefaults?.set(apiHost, forKey: "nulla_api_host")
        sharedDefaults?.set(userId, forKey: "nulla_user_id")
        sharedDefaults?.set(masterKeyData.base64EncodedString(), forKey: "nulla_master_key_b64")
        sharedDefaults?.synchronize()
        
        // 3. Write credentials.json to shared group container for reliable IPC
        let credsDict: [String: String] = [
            "token": token,
            "apiHost": apiHost,
            "masterKeyB64": masterKeyData.base64EncodedString(),
            "userId": userId
        ]
        if let json = try? JSONSerialization.data(withJSONObject: credsDict, options: .prettyPrinted) {
            if let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.app.nulla.macos") {
                try? FileManager.default.createDirectory(at: groupURL, withIntermediateDirectories: true)
                let credsURL = groupURL.appendingPathComponent("credentials.json")
                try? json.write(to: credsURL)
            }
            let pw = getpwuid(getuid())
            let realHome = (pw != nil && pw!.pointee.pw_dir != nil)
                ? String(cString: pw!.pointee.pw_dir)
                : "/Users/\(NSUserName())"
            let directGroupDir = URL(fileURLWithPath: "\(realHome)/Library/Group Containers/group.app.nulla.macos")
            try? FileManager.default.createDirectory(at: directGroupDir, withIntermediateDirectories: true)
            let directCredsURL = directGroupDir.appendingPathComponent("credentials.json")
            try? json.write(to: directCredsURL)
        }
        
        self.isAuthenticated = true
        self.errorMessage = nil
        
        // Immediately refresh storage telemetry via GET /api/nodes
        Task {
            await refreshStorage()
        }
        
        // Notify FileProvider domain to sync
        let domain = NSFileProviderDomain(identifier: NSFileProviderDomainIdentifier("app.nulla.vault"), displayName: "Nulla")
        if let manager = NSFileProviderManager(for: domain) {
            Task {
                try? await manager.signalEnumerator(for: .rootContainer)
            }
        }
        
        // Mount /Volumes/Nulla
        VolumeMountService.shared.mountVolume()
    }
    
    @MainActor
    public func logout() {
        VolumeMountService.shared.ejectVolume()
        
        KeychainHelper.delete(key: "nulla_api_token")
        KeychainHelper.delete(key: "nulla_master_key")
        let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos")
        sharedDefaults?.removeObject(forKey: "nulla_api_token")
        sharedDefaults?.removeObject(forKey: "nulla_user_id")
        sharedDefaults?.removeObject(forKey: "nulla_master_key_b64")
        sharedDefaults?.synchronize()
        
        if let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.app.nulla.macos") {
            let credsURL = groupURL.appendingPathComponent("credentials.json")
            try? FileManager.default.removeItem(at: credsURL)
        }
        let pw = getpwuid(getuid())
        let realHome = (pw != nil && pw!.pointee.pw_dir != nil)
            ? String(cString: pw!.pointee.pw_dir)
            : "/Users/\(NSUserName())"
        let directCredsURL = URL(fileURLWithPath: "\(realHome)/Library/Group Containers/group.app.nulla.macos/credentials.json")
        try? FileManager.default.removeItem(at: directCredsURL)
        
        self.isAuthenticated = false
        self.cloudStorageUsed = "0 bytes"
        self.localDiskUsed = "0 bytes"
        self.nodes = []
        self.userStorageQuotaBytes = 5_368_709_120
        self.userStorageUsedBytes = 0
    }
    
    // MARK: - Live Storage Telemetry
    
    @MainActor
    public func refreshStorage() async {
        guard let token = getAuthToken() else {
            // Unauthenticated state: strictly display 0 bytes, never mock numbers
            self.isAuthenticated = false
            self.cloudStorageUsed = "0 bytes"
            self.localDiskUsed = "0 bytes"
            self.nodes = []
            return
        }
        
        self.isAuthenticated = true
        let url = apiBaseURL.appendingPathComponent("api/nodes")
        var request = URLRequest(url: url)
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpMethod = "GET"
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return
            }
            
            let decoder = JSONDecoder()
            let result = try decoder.decode(NodesListResponse.self, from: data)
            
            var totalBytes: Int64 = 0
            var decryptedItems: [VaultNodeItem] = []
            let key = getMasterKey()
            
            for node in result.nodes {
                totalBytes += node.size_bytes
                
                var clearName = node.name ?? "File_\(node.id.prefix(6))"
                if let masterKey = key, let enc = node.name_encrypted, !enc.isEmpty, let iv = node.name_iv, !iv.isEmpty {
                    do {
                        let decrypted = try CryptoKitEngine.shared.decryptMetadata(
                            ciphertextBase64: enc,
                            ivHex: iv,
                            masterKey: masterKey
                        )
                        if !decrypted.isEmpty {
                            clearName = decrypted
                        }
                    } catch {
                        // Keep clearName as fallback if key mismatch
                    }
                }
                
                decryptedItems.append(
                    VaultNodeItem(
                        id: node.id,
                        name: clearName,
                        sizeBytes: node.size_bytes,
                        sizeFormatted: formatByteCount(node.size_bytes),
                        localSizeFormatted: "0 B",
                        isFolder: node.type == "folder"
                    )
                )
            }
            
            self.cloudStorageUsed = formatByteCount(totalBytes)
            self.localDiskUsed = "0 bytes"
            self.nodes = decryptedItems
            if let quota = result.storage_quota_bytes {
                self.userStorageQuotaBytes = quota
            }
            if let used = result.storage_used_bytes {
                self.userStorageUsedBytes = used
            }
        } catch {
            // On network failure or offline, keep real 0 bytes or cached status
        }
    }
    
    // MARK: - 4 MB Chunk Upload Pipeline
    
    public func uploadFile(url: URL) async throws {
        guard url.startAccessingSecurityScopedResource() || true else { return }
        defer { url.stopAccessingSecurityScopedResource() }
        
        let fileData = try Data(contentsOf: url)
        let filename = url.lastPathComponent
        let fileSize = Int64(fileData.count)
        
        await MainActor.run {
            self.isUploading = true
            self.uploadProgress = 0.0
            self.currentUploadFileName = "Encrypting \(filename)..."
            self.errorMessage = nil
        }
        
        guard let token = getAuthToken(), let masterKey = getMasterKey() else {
            await MainActor.run {
                self.isUploading = false
                self.errorMessage = "Not authenticated. Open Settings to unlock your vault."
            }
            return
        }
        
        let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        
        // 1. Direct R2 Native Upload Flow (Helumi Architecture)
        do {
            let createURL = apiBaseURL.appendingPathComponent("api/nodes")
            var createReq = URLRequest(url: createURL)
            createReq.httpMethod = "POST"
            createReq.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            createReq.addValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let createPayload: [String: Any] = [
                "name": filename,
                "mime_type": mimeType,
                "size_bytes": fileSize
            ]
            createReq.httpBody = try JSONSerialization.data(withJSONObject: createPayload)
            
            let (createData, createResp) = try await URLSession.shared.data(for: createReq)
            guard let createHttp = createResp as? HTTPURLResponse, (200...299).contains(createHttp.statusCode) else {
                throw NSError(domain: "NullaUpload", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to initialize node record."])
            }
            
            struct DirectNodeResponse: Decodable {
                struct DirectNode: Decodable {
                    let id: String
                }
                let node: DirectNode
            }
            let nodeRes = try JSONDecoder().decode(DirectNodeResponse.self, from: createData)
            let nodeId = nodeRes.node.id
            
            await MainActor.run {
                self.uploadProgress = 0.15
                self.currentUploadFileName = "Streaming \(filename) to R2..."
            }
            
            let contentURL = apiBaseURL.appendingPathComponent("api/nodes/\(nodeId)/content")
            var contentReq = URLRequest(url: contentURL)
            contentReq.httpMethod = "PUT"
            contentReq.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            contentReq.addValue(mimeType, forHTTPHeaderField: "Content-Type")
            
            let (_, uploadResp) = try await URLSession.shared.upload(for: contentReq, from: fileData)
            guard let uploadHttp = uploadResp as? HTTPURLResponse, (200...299).contains(uploadHttp.statusCode) else {
                throw NSError(domain: "NullaUpload", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to stream content to R2."])
            }
            
            // Notify FileProvider and WebDAV volume
            let domain = NSFileProviderDomain(identifier: NSFileProviderDomainIdentifier("app.nulla.vault"), displayName: "Nulla")
            if let manager = NSFileProviderManager(for: domain) {
                try? await manager.signalEnumerator(for: .rootContainer)
            }
            VolumeMountService.shared.checkMountStatus()
            
            await MainActor.run {
                self.isUploading = false
                self.uploadProgress = 1.0
                self.currentUploadFileName = ""
            }
            await refreshStorage()
            return
        } catch {
            // Fallback to chunked upload if direct fails
        }
        
        // 2. Fallback: Slicing into 4 MB fixed blocks
        let chunkSize = CryptoKitEngine.chunkSize // 4 MB
        let totalChunks = max(1, Int(ceil(Double(fileData.count) / Double(chunkSize))))
        
        let (encryptedName, nameIv) = try CryptoKitEngine.shared.encryptMetadata(
            plaintext: filename,
            masterKey: masterKey
        )
        
        let initURL = apiBaseURL.appendingPathComponent("api/upload/chunk/init")
        var initReq = URLRequest(url: initURL)
        initReq.httpMethod = "POST"
        initReq.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        initReq.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let initPayload: [String: Any] = [
            "name_encrypted": encryptedName,
            "name_iv": nameIv,
            "size_bytes": fileSize,
            "total_chunks": totalChunks
        ]
        initReq.httpBody = try JSONSerialization.data(withJSONObject: initPayload)
        
        let (initData, initResp) = try await URLSession.shared.data(for: initReq)
        guard let initHttp = initResp as? HTTPURLResponse, (200...299).contains(initHttp.statusCode) else {
            throw NSError(domain: "NullaUpload", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to initialize upload session."])
        }
        
        let sessionInfo = try JSONDecoder().decode(UploadInitResponse.self, from: initData)
        let sessionId = sessionInfo.session_id
        
        for chunkIndex in 0..<totalChunks {
            let start = chunkIndex * chunkSize
            let end = min(start + chunkSize, fileData.count)
            let chunkPlaintext = fileData.subdata(in: start..<end)
            
            await MainActor.run {
                self.currentUploadFileName = "Uploading \(filename) (\(chunkIndex + 1)/\(totalChunks))"
            }
            
            let (encryptedChunkWithTag, _) = try CryptoKitEngine.shared.encryptChunk(
                masterKey: masterKey,
                chunkIndex: chunkIndex,
                plaintext: chunkPlaintext
            )
            
            let chunkUrl = apiBaseURL.appendingPathComponent("api/upload/chunk/\(sessionId)/\(chunkIndex)")
            var chunkReq = URLRequest(url: chunkUrl)
            chunkReq.httpMethod = "PUT"
            chunkReq.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            chunkReq.addValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
            chunkReq.httpBody = encryptedChunkWithTag
            
            let (_, chunkResp) = try await URLSession.shared.data(for: chunkReq)
            guard let chunkHttp = chunkResp as? HTTPURLResponse, (200...299).contains(chunkHttp.statusCode) else {
                throw NSError(domain: "NullaUpload", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed chunk \(chunkIndex) upload."])
            }
            
            await MainActor.run {
                self.uploadProgress = Double(chunkIndex + 1) / Double(totalChunks)
            }
        }
        
        let completeURL = apiBaseURL.appendingPathComponent("api/upload/chunk/complete")
        var completeReq = URLRequest(url: completeURL)
        completeReq.httpMethod = "POST"
        completeReq.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        completeReq.addValue("application/json", forHTTPHeaderField: "Content-Type")
        completeReq.httpBody = try JSONSerialization.data(withJSONObject: ["session_id": sessionId])
        
        let (_, completeResp) = try await URLSession.shared.data(for: completeReq)
        guard let completeHttp = completeResp as? HTTPURLResponse, (200...299).contains(completeHttp.statusCode) else {
            throw NSError(domain: "NullaUpload", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to finalize upload."])
        }
        
        let domain = NSFileProviderDomain(identifier: NSFileProviderDomainIdentifier("app.nulla.vault"), displayName: "Nulla")
        if let manager = NSFileProviderManager(for: domain) {
            try? await manager.signalEnumerator(for: .rootContainer)
        }
        
        await MainActor.run {
            self.isUploading = false
            self.uploadProgress = 1.0
            self.currentUploadFileName = ""
        }
        
        await refreshStorage()
    }
    
    // MARK: - Helpers
    
    public func formatByteCount(_ bytes: Int64) -> String {
        if bytes == 0 { return "0 bytes" }
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useBytes, .useKB, .useMB, .useGB, .useTB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Data Models

public struct VaultNodeItem: Identifiable, Sendable {
    public let id: String
    public let name: String
    public let sizeBytes: Int64
    public let sizeFormatted: String
    public let localSizeFormatted: String
    public let isFolder: Bool
}

private struct SaltQueryResponse: Decodable {
    let salt: String
    let registered: Bool?
}

private struct LoginSuccessResponse: Decodable {
    let token: String
    let user: UserPayload?
}

private struct UserPayload: Decodable {
    let id: String
    let email: String?
}

private struct NodesListResponse: Decodable {
    let nodes: [RawNodeItem]
    let storage_quota_bytes: Int64?
    let storage_used_bytes: Int64?
}

private struct RawNodeItem: Decodable {
    let id: String
    let parent_id: String?
    let name: String?
    let name_encrypted: String?
    let name_iv: String?
    let type: String
    let size_bytes: Int64
    let chunk_count: Int?
    let is_encrypted: Int?
}

private struct UploadInitResponse: Decodable {
    let session_id: String
    let node_id: String
    let chunk_size_bytes: Int
    let total_chunks: Int
}
