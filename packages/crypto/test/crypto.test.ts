import { describe, expect, it } from 'bun:test';
import {
  generateSalt,
  deriveKeys,
  encryptMetadata,
  decryptMetadata,
  deriveChunkIV,
  encryptChunk,
  decryptChunk,
  getChunkRangeForByteRange,
  calculateChunkCount,
  CHUNK_SIZE,
} from '../src/index';

describe('Nulla Cryptographic Engine (@nulla/crypto)', () => {
  const password = 'TestMasterPassword!2026';
  const salt = generateSalt();

  it('derives master key and server auth key from password and salt', async () => {
    const keys = await deriveKeys(password, salt);
    expect(keys.masterKey).toBeDefined();
    expect(keys.masterKeyRaw.byteLength).toBe(32);
    expect(keys.masterKeyHex.length).toBe(64);
    expect(keys.serverAuthKey.length).toBe(64);

    // Derivation is deterministic with same password and salt
    const keys2 = await deriveKeys(password, salt);
    expect(keys2.masterKeyHex).toBe(keys.masterKeyHex);
    expect(keys2.serverAuthKey).toBe(keys.serverAuthKey);
  });

  it('encrypts and decrypts metadata (filenames & folders) with AES-GCM', async () => {
    const keys = await deriveKeys(password, salt);
    const plaintext = 'Secret-Project-Proposal-4K.mov';

    const encrypted = await encryptMetadata(plaintext, keys.masterKey);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(plaintext);
    expect(encrypted.ciphertext).not.toContain('/');
    expect(encrypted.ciphertext).not.toContain('+');

    const decrypted = await decryptMetadata(encrypted, keys.masterKey);
    expect(decrypted).toBe(plaintext);
  });

  it('generates deterministic HMAC-SHA256 chunk IVs based on index', async () => {
    const keys = await deriveKeys(password, salt);

    const iv0_a = await deriveChunkIV(keys.masterKeyRaw, 0);
    const iv0_b = await deriveChunkIV(keys.masterKeyRaw, 0);
    const iv1 = await deriveChunkIV(keys.masterKeyRaw, 1);

    expect(iv0_a.byteLength).toBe(12);
    expect(Buffer.from(iv0_a).equals(Buffer.from(iv0_b))).toBe(true);
    expect(Buffer.from(iv0_a).equals(Buffer.from(iv1))).toBe(false);
  });

  it('encrypts and decrypts a 4 MB block with authenticated tag integrity', async () => {
    const keys = await deriveKeys(password, salt);

    // Create 1 MB dummy data buffer
    const originalPlaintext = new Uint8Array(1024 * 1024);
    for (let i = 0; i < originalPlaintext.length; i++) {
      originalPlaintext[i] = i % 256;
    }

    const encryptedChunk = await encryptChunk(keys.masterKey, keys.masterKeyRaw, 0, originalPlaintext);
    // Ciphertext contains 16-byte GCM tag appended
    expect(encryptedChunk.sizeBytes).toBe(originalPlaintext.length + 16);
    expect(encryptedChunk.hash).toBeDefined();

    const decrypted = await decryptChunk(keys.masterKey, keys.masterKeyRaw, 0, encryptedChunk.data);
    expect(decrypted.byteLength).toBe(originalPlaintext.length);
    expect(Buffer.from(decrypted).equals(Buffer.from(originalPlaintext))).toBe(true);
  });

  it('accurately calculates chunk ranges for random-access media seeking', () => {
    // 0 to 4MB - 1 is chunk 0
    const range1 = getChunkRangeForByteRange(0, CHUNK_SIZE - 1);
    expect(range1.startChunkIndex).toBe(0);
    expect(range1.endChunkIndex).toBe(0);
    expect(range1.offsetInStartChunk).toBe(0);

    // Cross-chunk range (from byte 4,000,000 to 5,000,000)
    const range2 = getChunkRangeForByteRange(4000000, 5000000);
    expect(range2.startChunkIndex).toBe(0);
    expect(range2.endChunkIndex).toBe(1);

    expect(calculateChunkCount(CHUNK_SIZE * 3 + 100)).toBe(4);
  });
});
