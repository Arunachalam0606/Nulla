import XCTest
import Foundation
import CryptoKit
@testable import NullaShared

final class CryptoKitEngineTests: XCTestCase {
    let password = "TestMasterPassword!2026"
    let saltHex = "a1b2c3d4e5f60718293a4b5c6d7e8f90"
    
    func testPbkdf2KeyDerivation() throws {
        let (_, serverAuthKeyHex) = try CryptoKitEngine.shared.deriveKeys(password: password, saltHex: saltHex)
        XCTAssertEqual(serverAuthKeyHex.count, 64)
        
        let (_, serverAuthKeyHex2) = try CryptoKitEngine.shared.deriveKeys(password: password, saltHex: saltHex)
        XCTAssertEqual(serverAuthKeyHex, serverAuthKeyHex2)
    }
    
    func testDeterministicChunkNonce() throws {
        let (masterKey, _) = try CryptoKitEngine.shared.deriveKeys(password: password, saltHex: saltHex)
        
        let nonce0_a = try CryptoKitEngine.shared.deriveChunkNonce(masterKey: masterKey, chunkIndex: 0)
        let nonce0_b = try CryptoKitEngine.shared.deriveChunkNonce(masterKey: masterKey, chunkIndex: 0)
        let nonce1 = try CryptoKitEngine.shared.deriveChunkNonce(masterKey: masterKey, chunkIndex: 1)
        
        XCTAssertEqual(Data(nonce0_a), Data(nonce0_b))
        XCTAssertNotEqual(Data(nonce0_a), Data(nonce1))
    }
    
    func testFourMegabyteChunkDecryption() throws {
        let (masterKey, _) = try CryptoKitEngine.shared.deriveKeys(password: password, saltHex: saltHex)
        let chunkIndex = 42
        
        let plaintextString = "Nulla Zero-Knowledge 4MB Block Stream Payload"
        let plaintextData = Data(plaintextString.utf8)
        
        let nonce = try CryptoKitEngine.shared.deriveChunkNonce(masterKey: masterKey, chunkIndex: chunkIndex)
        let sealedBox = try AES.GCM.seal(plaintextData, using: masterKey, nonce: nonce)
        
        var ciphertextWithTag = sealedBox.ciphertext
        ciphertextWithTag.append(sealedBox.tag)
        
        let decryptedData = try CryptoKitEngine.shared.decryptChunk(
            masterKey: masterKey,
            chunkIndex: chunkIndex,
            ciphertextWithTag: ciphertextWithTag
        )
        
        XCTAssertEqual(String(data: decryptedData, encoding: .utf8), plaintextString)
    }
}
