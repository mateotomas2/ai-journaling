/**
 * PBKDF2 Key Derivation for password-based encryption
 * Used to derive encryption keys from user passwords
 */

// NIST SP 800-132 recommends 310,000+ iterations for SHA-256 (2023)
// Legacy users may have keys derived with 100,000 iterations
const PBKDF2_ITERATIONS_V2 = 310000;
const PBKDF2_ITERATIONS_V1 = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 256;

/**
 * Current iteration count for new key derivations
 */
export const CURRENT_ITERATIONS = PBKDF2_ITERATIONS_V2;

/**
 * Legacy iteration count for backward compatibility
 */
export const LEGACY_ITERATIONS = PBKDF2_ITERATIONS_V1;

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Derive an AES-GCM key from a password and salt using PBKDF2
 * @param password - User's password
 * @param salt - Random salt bytes
 * @param iterations - Optional iteration count (defaults to current standard)
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = CURRENT_ITERATIONS
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
      iterations,
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

/**
 * Fixed, app-specific salt for sync encryption.
 * Using a fixed salt means same password = same key on any device,
 * enabling cross-device sync without envelope/password-prompt complexity.
 * Security: 310K PBKDF2 iterations + OAuth-gated Google Drive appDataFolder
 * make rainbow table attacks prohibitively expensive.
 */
const SYNC_SALT = new TextEncoder().encode('reflekt-journal-sync-v1');

/**
 * Derive a deterministic sync encryption key from a password.
 * Same password on any device produces the same key.
 */
export async function deriveSyncKey(password: string): Promise<CryptoKey> {
  return deriveKey(password, SYNC_SALT, CURRENT_ITERATIONS);
}
