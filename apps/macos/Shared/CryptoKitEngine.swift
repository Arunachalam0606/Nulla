//
// CryptoKitEngine.swift
// Nulla Native macOS E2EE Engine
// Exact Cryptographic Parity with @nulla/crypto (TypeScript / WebCrypto)
//

import Foundation
import CryptoKit
import CommonCrypto

public final class CryptoKitEngine: @unchecked Sendable {
    public static let shared = CryptoKitEngine()
    
    public static let chunkSize: Int = 4 * 1024 * 1024 // 4 MB fixed blocks
    public static let gcmIVLength: Int = 12 // 96 bits
    public static let pbkdf2Iterations: UInt32 = 100_000
    
    private init() {}
    
    // MARK: - Key Derivation (PBKDF2 100k Rounds)
    
    /// Derives 512 bits (64 bytes) from password and hex salt:
    /// - Bytes 0..<32: Master Encryption Key (AES-256-GCM / HMAC)
    /// - Bytes 32..<64: Server Auth Key (Hex encoded for auth)
    public func deriveKey(password: String, salt: String) throws -> (masterKey: SymmetricKey, serverAuthKeyHex: String) {
        return try deriveKeys(password: password, saltHex: salt)
    }

    public func deriveKeys(password: String, saltHex: String) throws -> (masterKey: SymmetricKey, serverAuthKeyHex: String) {
        guard let saltData = Data(hexString: saltHex) else {
            throw CryptoError.invalidSalt
        }
        
        var derivedBytes = [UInt8](repeating: 0, count: 64)
        
        let status = password.withCString { passCString in
            saltData.withUnsafeBytes { saltBytes in
                guard let saltBase = saltBytes.bindMemory(to: UInt8.self).baseAddress else {
                    return Int32(kCCParamError)
                }
                return CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    passCString,
                    password.utf8.count,
                    saltBase,
                    saltData.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                    Self.pbkdf2Iterations,
                    &derivedBytes,
                    64
                )
            }
        }
        
        guard status == kCCSuccess else {
            throw CryptoError.keyDerivationFailed(status: status)
        }
        
        let masterKeyBytes = Data(derivedBytes[0..<32])
        let serverAuthBytes = Data(derivedBytes[32..<64])
        
        let masterKey = SymmetricKey(data: masterKeyBytes)
        let serverAuthKeyHex = serverAuthBytes.map { String(format: "%02hhx", $0) }.joined()
        
        return (masterKey, serverAuthKeyHex)
    }
    
    // MARK: - Deterministic Chunk Nonce Derivation
    
    /// Exact parity with TypeScript deriveChunkIV:
    /// HMAC-SHA256(MasterKey, chunkIndex as BigEndian UInt64).prefix(12)
    public func deriveChunkNonce(masterKey: SymmetricKey, chunkIndex: Int) throws -> AES.GCM.Nonce {
        var bigEndianIndex = UInt64(chunkIndex).bigEndian
        let indexData = Data(bytes: &bigEndianIndex, count: MemoryLayout<UInt64>.size)
        
        let authenticationCode = HMAC<SHA256>.authenticationCode(for: indexData, using: masterKey)
        let nonceData = Data(authenticationCode.prefix(Self.gcmIVLength))
        
        return try AES.GCM.Nonce(data: nonceData)
    }
    
    // MARK: - 4 MB Chunk Encryption & Decryption
    
    /// Encrypts a 4 MB block in RAM using CryptoKit AES.GCM with deterministic nonce.
    public func encryptChunk(
        masterKey: SymmetricKey,
        chunkIndex: Int,
        plaintext: Data
    ) throws -> (data: Data, hash: String) {
        let nonce = try deriveChunkNonce(masterKey: masterKey, chunkIndex: chunkIndex)
        let sealedBox = try AES.GCM.seal(plaintext, using: masterKey, nonce: nonce)
        
        var ciphertextWithTag = sealedBox.ciphertext
        ciphertextWithTag.append(sealedBox.tag)
        
        let digest = SHA256.hash(data: ciphertextWithTag)
        let hashString = digest.map { String(format: "%02hhx", $0) }.joined()
        
        return (ciphertextWithTag, hashString)
    }
    
    /// Decrypts a 4 MB block in RAM (~5ms) using CryptoKit AES.GCM.
    /// Input: Ciphertext + 16-byte authentication tag appended.
    public func decryptChunk(
        masterKey: SymmetricKey,
        chunkIndex: Int,
        ciphertextWithTag: Data
    ) throws -> Data {
        let nonce = try deriveChunkNonce(masterKey: masterKey, chunkIndex: chunkIndex)
        
        guard ciphertextWithTag.count >= 16 else {
            throw CryptoError.ciphertextTooShort
        }
        
        let tag = ciphertextWithTag.suffix(16)
        let ciphertext = ciphertextWithTag.prefix(ciphertextWithTag.count - 16)
        
        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
        return try AES.GCM.open(sealedBox, using: masterKey)
    }
    
    // MARK: - Metadata Encryption & Decryption
    
    /// Encrypts metadata (filename, folder name) with random 12-byte IV.
    public func encryptMetadata(
        plaintext: String,
        masterKey: SymmetricKey
    ) throws -> (ciphertextBase64: String, ivHex: String) {
        let plaintextData = Data(plaintext.utf8)
        let nonce = AES.GCM.Nonce()
        let sealedBox = try AES.GCM.seal(plaintextData, using: masterKey, nonce: nonce)
        
        var ciphertextWithTag = sealedBox.ciphertext
        ciphertextWithTag.append(sealedBox.tag)
        
        let ivData = Data(nonce)
        let ivHex = ivData.map { String(format: "%02hhx", $0) }.joined()
        
        return (ciphertextWithTag.base64EncodedString(), ivHex)
    }
    
    /// Decrypts metadata (filename, folder name) from base64 ciphertext and hex IV.
    public func decryptMetadata(
        ciphertextBase64: String,
        ivHex: String,
        masterKey: SymmetricKey
    ) throws -> String {
        guard let combinedData = Data(base64Encoded: ciphertextBase64),
              let ivData = Data(hexString: ivHex) else {
            throw CryptoError.invalidMetadataEncoding
        }
        
        let nonce = try AES.GCM.Nonce(data: ivData)
        guard combinedData.count >= 16 else {
            throw CryptoError.ciphertextTooShort
        }
        
        let tag = combinedData.suffix(16)
        let ciphertext = combinedData.prefix(combinedData.count - 16)
        
        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
        let plaintextData = try AES.GCM.open(sealedBox, using: masterKey)
        
        guard let plaintext = String(data: plaintextData, encoding: .utf8) else {
            throw CryptoError.utf8DecodingFailed
        }
        
        return plaintext
    }
    
    // MARK: - Errors
    
    public enum CryptoError: Error, LocalizedError {
        case invalidSalt
        case keyDerivationFailed(status: Int32)
        case ciphertextTooShort
        case invalidMetadataEncoding
        case utf8DecodingFailed
        
        public var errorDescription: String? {
            switch self {
            case .invalidSalt: return "Invalid cryptographic salt hex representation."
            case .keyDerivationFailed(let status): return "PBKDF2 derivation failed with error \(status)."
            case .ciphertextTooShort: return "Ciphertext payload is shorter than 16-byte authentication tag."
            case .invalidMetadataEncoding: return "Failed to decode base64 or hex metadata."
            case .utf8DecodingFailed: return "Plaintext data is not valid UTF-8."
            }
        }
    }
}

// MARK: - Data Hex Extension

extension Data {
    public init?(hexString: String) {
        let clean = hexString.replacingOccurrences(of: "0x", with: "")
        var data = Data(capacity: clean.count / 2)
        
        var index = clean.startIndex
        while index < clean.endIndex {
            let nextIndex = clean.index(index, offsetBy: 2, limitedBy: clean.endIndex) ?? clean.endIndex
            let byteString = clean[index..<nextIndex]
            guard let byte = UInt8(byteString, radix: 16) else { return nil }
            data.append(byte)
            index = nextIndex
        }
        
        self = data
    }
}
