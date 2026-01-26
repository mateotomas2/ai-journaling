/**
 * Integration tests for biometric authentication flow
 */

import { describe, it, expect } from 'vitest';
import { deriveKey, exportKeyAsHex } from '@/services/crypto/keyDerivation';
import {
  deriveWrappingKey,
  wrapKey,
  unwrapKey,
  generateIV,
  generateWrappingSalt,
  bytesToBase64,
  base64ToBytes,
} from '@/services/crypto/wrappingKey';

describe('Biometric Authentication Flow', () => {
  describe('Full enrollment and unlock flow', () => {
    it('should complete full biometric setup and unlock cycle', async () => {
      // 1. User sets up password - derive encryption key
      const password = 'test-password-123';
      const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
      const encryptionKey = await deriveKey(password, passwordSalt);
      const encryptionKeyHex = await exportKeyAsHex(encryptionKey);

      expect(encryptionKeyHex).toHaveLength(64); // 32 bytes = 64 hex chars

      // 2. User enrolls biometric - simulate WebAuthn registration
      const webauthnSignature = crypto.getRandomValues(new Uint8Array(64)).buffer;
      const credentialId = 'mock-credential-id';

      // 3. Derive wrapping key from WebAuthn signature
      const wrappingSalt = generateWrappingSalt();
      const wrappingKey = await deriveWrappingKey(webauthnSignature, wrappingSalt);

      // 4. Wrap (encrypt) the encryption key
      const iv = generateIV();
      const wrappedKey = await wrapKey(encryptionKey, wrappingKey, iv);

      // 5. Store wrapped key (simulated)
      const storedData = {
        credentialId,
        wrappedKey: bytesToBase64(wrappedKey),
        salt: bytesToBase64(wrappingSalt),
        iv: bytesToBase64(iv),
      };

      // --- User locks app and comes back ---

      // 6. User unlocks with biometric - authenticate with WebAuthn
      // (In real flow, WebAuthn returns the same signature for same credential)
      const webauthnAuthSignature = webauthnSignature; // Same signature

      // 7. Retrieve stored wrapped key
      const retrievedWrappedKey = base64ToBytes(storedData.wrappedKey);
      const retrievedSalt = base64ToBytes(storedData.salt);
      const retrievedIv = base64ToBytes(storedData.iv);

      // 8. Derive wrapping key from WebAuthn signature
      const unwrappingKey = await deriveWrappingKey(
        webauthnAuthSignature,
        retrievedSalt
      );

      // 9. Unwrap (decrypt) the encryption key
      const unwrappedKey = await unwrapKey(
        retrievedWrappedKey.buffer as ArrayBuffer,
        unwrappingKey,
        retrievedIv
      );

      // 10. Export and verify it matches original
      const unwrappedKeyHex = await exportKeyAsHex(unwrappedKey);
      expect(unwrappedKeyHex).toBe(encryptionKeyHex);

      // 11. Verify the key can be used for encryption/decryption
      const testData = new TextEncoder().encode('Secret journal entry');
      const testIvArray = generateIV();
      const testIv = testIvArray.buffer as ArrayBuffer;

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: testIv },
        unwrappedKey,
        testData
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: testIv },
        encryptionKey,
        encrypted
      );

      const decryptedText = new TextDecoder().decode(decrypted);
      expect(decryptedText).toBe('Secret journal entry');
    });

    it('should fail to unlock with different WebAuthn signature', async () => {
      // Setup: Create and wrap a key
      const password = 'test-password-123';
      const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
      const encryptionKey = await deriveKey(password, passwordSalt);

      const webauthnSignature1 = crypto.getRandomValues(new Uint8Array(64)).buffer;
      const wrappingSalt = generateWrappingSalt();
      const wrappingKey = await deriveWrappingKey(webauthnSignature1, wrappingSalt);

      const iv = generateIV();
      const wrappedKey = await wrapKey(encryptionKey, wrappingKey, iv);

      // Attempt to unlock with different signature
      const webauthnSignature2 = crypto.getRandomValues(new Uint8Array(64)).buffer;
      const wrongUnwrappingKey = await deriveWrappingKey(webauthnSignature2, wrappingSalt);

      // Should fail to unwrap
      await expect(
        unwrapKey(wrappedKey, wrongUnwrappingKey, iv)
      ).rejects.toThrow();
    });

    it('should maintain password unlock after biometric enrollment', async () => {
      // 1. Setup password
      const password = 'test-password-123';
      const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
      const encryptionKey1 = await deriveKey(password, passwordSalt);
      const keyHex1 = await exportKeyAsHex(encryptionKey1);

      // 2. Enroll biometric (doesn't change password path)
      const webauthnSignature = crypto.getRandomValues(new Uint8Array(64)).buffer;
      const wrappingSalt = generateWrappingSalt();
      const wrappingKey = await deriveWrappingKey(webauthnSignature, wrappingSalt);
      const iv = generateIV();
      await wrapKey(encryptionKey1, wrappingKey, iv);

      // 3. Verify password still works
      const encryptionKey2 = await deriveKey(password, passwordSalt);
      const keyHex2 = await exportKeyAsHex(encryptionKey2);

      expect(keyHex2).toBe(keyHex1);
    });
  });

  describe('Error scenarios', () => {
    it('should handle corrupted wrapped key data', async () => {
      const password = 'test-password-123';
      const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
      const encryptionKey = await deriveKey(password, passwordSalt);

      const webauthnSignature = crypto.getRandomValues(new Uint8Array(64)).buffer;
      const wrappingSalt = generateWrappingSalt();
      const wrappingKey = await deriveWrappingKey(webauthnSignature, wrappingSalt);
      const iv = generateIV();
      await wrapKey(encryptionKey, wrappingKey, iv);

      // Corrupt the wrapped key
      const corruptedWrappedKey = crypto.getRandomValues(new Uint8Array(48)).buffer;

      await expect(
        unwrapKey(corruptedWrappedKey, wrappingKey, iv)
      ).rejects.toThrow();
    });

    it('should handle missing salt or IV', async () => {
      const password = 'test-password-123';
      const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
      const encryptionKey = await deriveKey(password, passwordSalt);

      const webauthnSignature = crypto.getRandomValues(new Uint8Array(64)).buffer;
      const wrappingSalt = generateWrappingSalt();
      const wrappingKey = await deriveWrappingKey(webauthnSignature, wrappingSalt);
      const iv = generateIV();
      const wrappedKey = await wrapKey(encryptionKey, wrappingKey, iv);

      // Try with wrong IV (simulates missing/corrupted IV)
      const wrongIv = generateIV();
      await expect(
        unwrapKey(wrappedKey, wrappingKey, wrongIv)
      ).rejects.toThrow();
    });
  });
});
