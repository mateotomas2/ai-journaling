/**
 * Key wrapping service
 * Encrypts/decrypts the encryption key using a wrapping key derived from WebAuthn
 */

/**
 * Derive a wrapping key from WebAuthn secret using HKDF
 */
export async function deriveWrappingKey(
  webauthnSecret: ArrayBuffer,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import the WebAuthn secret as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    webauthnSecret,
    'HKDF',
    false,
    ['deriveKey']
  );

  // Derive an AES-GCM key using HKDF
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: salt.buffer as ArrayBuffer,
      info: new TextEncoder().encode('Daily Journal Key Wrapping'),
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['wrapKey', 'unwrapKey']
  );
}

/**
 * Wrap (encrypt) the encryption key using the wrapping key
 */
export async function wrapKey(
  encryptionKey: CryptoKey,
  wrappingKey: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return crypto.subtle.wrapKey(
    'raw',
    encryptionKey,
    wrappingKey,
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
    }
  );
}

/**
 * Unwrap (decrypt) the encryption key using the wrapping key
 */
export async function unwrapKey(
  wrappedKey: ArrayBuffer,
  wrappingKey: CryptoKey,
  iv: Uint8Array
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    wrappingKey,
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
    },
    { name: 'AES-GCM', length: 256 },
    true, // extractable - needed to export as hex for RxDB
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random IV for AES-GCM
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)); // 96 bits for AES-GCM
}

/**
 * Generate a random salt for HKDF
 */
export function generateWrappingSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Convert bytes to base64 for storage
 */
export function bytesToBase64(bytes: Uint8Array | ArrayBuffer): string {
  const uint8Array =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...uint8Array));
}

/**
 * Convert base64 to bytes
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
