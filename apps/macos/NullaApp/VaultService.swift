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
    
    public var apiBaseURL: URL {
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
        return URL(string: "http://localhost:8787")!
    }
    
    private init() {
        self.isAuthenticated = (getAuthToken() != nil && getMasterKey() != nil)
    }
    
    // MARK: - Credentials
    
    public func getAuthToken() -> String? {
        if let tokenData = KeychainHelper.load(key: "nulla_api_token"),
           let token = String(data: tokenData, encoding: .utf8) {
            return token
        }
        return ProcessInfo.processInfo.environment["NULLA_AUTH_TOKEN"]
    }
    
    public func getMasterKey() -> SymmetricKey? {
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
        
        // Store session token, 256-bit Master Key, and API host securely in Apple Keychain
        KeychainHelper.save(key: "nulla_api_token", data: Data(result.token.utf8))
        let masterKeyData = masterKey.withUnsafeBytes { Data($0) }
        KeychainHelper.save(key: "nulla_master_key", data: masterKeyData)
        if let hostData = apiBaseURL.absoluteString.data(using: .utf8) {
            KeychainHelper.save(key: "nulla_api_host", data: hostData)
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
    }
    
    @MainActor
    public func logout() {
        KeychainHelper.delete(key: "nulla_api_token")
        KeychainHelper.delete(key: "nulla_master_key")
        self.isAuthenticated = false
        self.cloudStorageUsed = "0 bytes"
        self.localDiskUsed = "0 bytes"
        self.nodes = []
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
                
                var clearName = "File_\(node.id.prefix(6))"
                if let masterKey = key {
                    do {
                        clearName = try CryptoKitEngine.shared.decryptMetadata(
                            ciphertextBase64: node.name_encrypted,
                            ivHex: node.name_iv,
                            masterKey: masterKey
                        )
                    } catch {
                        clearName = "Encrypted Item"
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
        
        // 1. Slicing into 4 MB fixed blocks
        let chunkSize = CryptoKitEngine.chunkSize // 4 MB
        let totalChunks = max(1, Int(ceil(Double(fileData.count) / Double(chunkSize))))
        
        // 2. Encrypt Metadata
        let (encryptedName, nameIv) = try CryptoKitEngine.shared.encryptMetadata(
            plaintext: filename,
            masterKey: masterKey
        )
        
        // 3. Initiate Upload Session on Worker
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
        
        // 4. Encrypt and Upload Each 4 MB Block
        for chunkIndex in 0..<totalChunks {
            let start = chunkIndex * chunkSize
            let end = min(start + chunkSize, fileData.count)
            let chunkPlaintext = fileData.subdata(in: start..<end)
            
            await MainActor.run {
                self.currentUploadFileName = "Uploading \(filename) (\(chunkIndex + 1)/\(totalChunks))"
            }
            
            // Encrypt 4 MB chunk with deterministic HMAC IV via AES-256-GCM
            let (encryptedChunkWithTag, _) = try CryptoKitEngine.shared.encryptChunk(
                masterKey: masterKey,
                chunkIndex: chunkIndex,
                plaintext: chunkPlaintext
            )
            
            // PUT /api/upload/chunk/:session_id/:chunk_index
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
        
        // 5. Complete Upload Session
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
        
        // Notify FileProvider domain to refresh Finder
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
}

private struct NodesListResponse: Decodable {
    let nodes: [RawNodeItem]
}

private struct RawNodeItem: Decodable {
    let id: String
    let parent_id: String?
    let name_encrypted: String
    let name_iv: String
    let type: String
    let size_bytes: Int64
    let chunk_count: Int
}

private struct UploadInitResponse: Decodable {
    let session_id: String
    let node_id: String
    let chunk_size_bytes: Int
    let total_chunks: Int
}
