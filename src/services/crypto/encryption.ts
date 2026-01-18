/**
 * AES-GCM Encryption/Decryption helpers
 * Used to encrypt journal data at rest
 */

const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

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

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt ciphertext using AES-GCM
 * Expects base64-encoded string containing IV + ciphertext
 */
export async function decrypt(
  encryptedBase64: string,
  key: CryptoKey
): Promise<string> {
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedBase64), (c) =>
    c.charCodeAt(0)
  );

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
