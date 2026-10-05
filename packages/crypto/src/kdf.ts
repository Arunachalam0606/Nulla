import { PBKDF2_ITERATIONS } from './types';
import type { DerivedKeys } from './types';
import { bufferToHex, hexToUint8Array } from './utils';

export function generateSalt(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes);
}

export async function deriveKeys(password: string, saltHex: string): Promise<DerivedKeys> {
  const encoder = new TextEncoder();
  const saltBytes = hexToUint8Array(saltHex);

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive 512 bits (64 bytes)
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    512
  );

  const fullBytes = new Uint8Array(derivedBits);
  const masterKeyRaw = fullBytes.slice(0, 32); // First 32 bytes: Master Encryption Key (Never leaves client)
  const serverAuthRaw = fullBytes.slice(32, 64); // Second 32 bytes: Server Auth Key

  const masterKey = await crypto.subtle.importKey(
    'raw',
    masterKeyRaw as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return {
    masterKey,
    masterKeyRaw,
    masterKeyHex: bufferToHex(masterKeyRaw),
    serverAuthKey: bufferToHex(serverAuthRaw),
  };
}

export async function importMasterKeyFromHex(masterKeyHex: string): Promise<CryptoKey> {
  const rawBytes = hexToUint8Array(masterKeyHex);
  return await crypto.subtle.importKey(
    'raw',
    rawBytes as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}
