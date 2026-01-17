/**
 * PBKDF2 Key Derivation for password-based encryption
 * Used to derive encryption keys from user passwords
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 256;

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Derive an AES-GCM key from a password and salt using PBKDF2
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true, // extractable - needed for exportKeyAsHex
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey as a hex string for use with RxDB encryption
 */
export async function exportKeyAsHex(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(exported);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a salt to base64 for storage
 */
export function saltToBase64(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt));
}

/**
 * Convert a base64 string back to salt
 */
export function base64ToSalt(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
