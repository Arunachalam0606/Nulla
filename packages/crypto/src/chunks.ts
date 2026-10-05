import { CHUNK_SIZE, AES_GCM_TAG_LENGTH, GCM_IV_LENGTH } from './types';
import type { EncryptedChunk, RangeMapping } from './types';
import { bufferToHex, sha256 } from './utils';

/**
 * Deterministically derives a 12-byte (96-bit) AES-GCM IV for a chunk index using HMAC-SHA256.
 * Parity Specification with Swift CryptoKit:
 *   let hmac = HMAC<SHA256>.authenticationCode(for: chunkIndexData, using: SymmetricKey(data: masterKey))
 *   let nonce = try AES.GCM.Nonce(data: Data(hmac.prefix(12)))
 */
export async function deriveChunkIV(masterKeyRaw: Uint8Array, chunkIndex: number): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    masterKeyRaw as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Encode chunk index as 8-byte Big Endian Uint64 buffer
  const indexData = new Uint8Array(8);
  const dataView = new DataView(indexData.buffer);
  dataView.setBigUint64(0, BigInt(chunkIndex), false);

  const signature = await crypto.subtle.sign('HMAC', hmacKey, indexData as unknown as BufferSource);
  // Slice first 12 bytes (96 bits) for AES-GCM Nonce
  return new Uint8Array(signature).slice(0, GCM_IV_LENGTH);
}

/**
 * Slices a total size into 4 MB chunk count.
 */
export function calculateChunkCount(totalSizeBytes: number): number {
  if (totalSizeBytes <= 0) return 0;
  return Math.ceil(totalSizeBytes / CHUNK_SIZE);
}

/**
 * Maps a random-access byte range (e.g. video scrub) to required chunk indexes and internal offsets.
 */
export function getChunkRangeForByteRange(startByte: number, endByte: number): RangeMapping {
  const startChunkIndex = Math.floor(startByte / CHUNK_SIZE);
  const endChunkIndex = Math.floor(endByte / CHUNK_SIZE);
  const offsetInStartChunk = startByte % CHUNK_SIZE;
  const lengthInEndChunk = (endByte % CHUNK_SIZE) + 1;

  return {
    startChunkIndex,
    endChunkIndex,
    offsetInStartChunk,
    lengthInEndChunk,
  };
}

/**
 * Encrypts a 4 MB block with AES-256-GCM using deterministically derived IV.
 */
export async function encryptChunk(
  masterKey: CryptoKey,
  masterKeyRaw: Uint8Array,
  chunkIndex: number,
  chunkPlaintext: Uint8Array
): Promise<EncryptedChunk> {
  const iv = await deriveChunkIV(masterKeyRaw, chunkIndex);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    masterKey,
    chunkPlaintext as unknown as BufferSource
  );

  const encryptedData = new Uint8Array(encryptedBuffer);
  const hash = await sha256(encryptedData);

  return {
    chunkIndex,
    data: encryptedData,
    hash,
    sizeBytes: encryptedData.byteLength,
  };
}

/**
 * Decrypts a 4 MB block with AES-256-GCM using deterministically derived IV.
 */
export async function decryptChunk(
  masterKey: CryptoKey,
  masterKeyRaw: Uint8Array,
  chunkIndex: number,
  chunkCiphertextWithTag: Uint8Array
): Promise<Uint8Array> {
  const iv = await deriveChunkIV(masterKeyRaw, chunkIndex);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    masterKey,
    chunkCiphertextWithTag as unknown as BufferSource
  );

  return new Uint8Array(decryptedBuffer);
}
