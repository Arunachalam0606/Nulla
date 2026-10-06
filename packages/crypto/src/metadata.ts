import { AES_GCM_TAG_LENGTH, GCM_IV_LENGTH } from './types';
import type { EncryptedMetadata } from './types';
import {
  bufferToHex,
  hexToUint8Array,
  uint8ArrayToBase64Url,
  base64ToUint8Array,
} from './utils';

/**
 * Encrypts a string (e.g. filename, directory name, mime type) with AES-256-GCM.
 */
export async function encryptMetadata(
  plaintext: string,
  masterKey: CryptoKey
): Promise<EncryptedMetadata> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Generate random 12-byte IV for metadata
  const iv = new Uint8Array(GCM_IV_LENGTH);
  crypto.getRandomValues(iv);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    masterKey,
    plaintextBytes as unknown as BufferSource
  );

  return {
    ciphertext: uint8ArrayToBase64Url(new Uint8Array(encryptedBuffer)),
    iv: bufferToHex(iv),
  };
}

/**
 * Decrypts encrypted metadata back to string using AES-256-GCM.
 */
export async function decryptMetadata(
  encrypted: EncryptedMetadata,
  masterKey: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const ciphertextBytes = base64ToUint8Array(encrypted.ciphertext);
  const ivBytes = hexToUint8Array(encrypted.iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as unknown as BufferSource,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    masterKey,
    ciphertextBytes as unknown as BufferSource
  );

  return decoder.decode(decryptedBuffer);
}
