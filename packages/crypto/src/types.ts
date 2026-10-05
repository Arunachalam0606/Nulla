export const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB fixed blocks
export const AES_GCM_TAG_LENGTH = 128; // 128-bit authentication tag (16 bytes)
export const GCM_IV_LENGTH = 12; // 96-bit IV (12 bytes)
export const PBKDF2_ITERATIONS = 100000;

export interface DerivedKeys {
  masterKey: CryptoKey;
  masterKeyRaw: Uint8Array;
  masterKeyHex: string;
  serverAuthKey: string;
}

export interface EncryptedChunk {
  chunkIndex: number;
  data: Uint8Array;
  hash: string;
  sizeBytes: number;
}

export interface EncryptedMetadata {
  ciphertext: string;
  iv: string;
}

export interface ChunkSliceInfo {
  chunkIndex: number;
  startByte: number;
  endByte: number;
}

export interface RangeMapping {
  startChunkIndex: number;
  endChunkIndex: number;
  offsetInStartChunk: number;
  lengthInEndChunk: number;
}
