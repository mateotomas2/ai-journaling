/**
 * AES-GCM Encryption/Decryption helpers
 * Used to encrypt journal data at rest
 */

const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const BASE64_CHUNK = 8192;

/** Encode Uint8Array to base64 in chunks (avoids call stack overflow for large data) */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Decode base64 to Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt plaintext using AES-GCM
 * Returns base64-encoded string containing IV + ciphertext
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return as base64 (chunked to avoid call stack size limits on large data)
  return uint8ArrayToBase64(combined);
}

/**
 * Decrypt ciphertext using AES-GCM
 * Expects base64-encoded string containing IV + ciphertext
 */
export async function decrypt(
  encryptedBase64: string,
  key: CryptoKey
): Promise<string> {
  // Decode base64 (chunked to match encoder)
  const combined = base64ToUint8Array(encryptedBase64);

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  // Decode to string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
