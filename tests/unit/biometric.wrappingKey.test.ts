/**
 * Unit tests for Key Wrapping service
 */

import { describe, it, expect } from 'vitest';
import {
  deriveWrappingKey,
  wrapKey,
  unwrapKey,
  generateIV,
  generateWrappingSalt,
  bytesToBase64,
  base64ToBytes,
} from '@/services/crypto/wrappingKey';

describe('Key Wrapping Service', () => {
  describe('generateIV', () => {
    it('should generate a 12-byte IV for AES-GCM', () => {
      const iv = generateIV();
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(iv.length).toBe(12);
    });

    it('should generate different IVs each time', () => {
      const iv1 = generateIV();
      const iv2 = generateIV();
      expect(iv1).not.toEqual(iv2);
    });
  });

  describe('generateWrappingSalt', () => {
    it('should generate a 32-byte salt', () => {
      const salt = generateWrappingSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(32);
    });

    it('should generate different salts each time', () => {
      const salt1 = generateWrappingSalt();
      const salt2 = generateWrappingSalt();
      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('bytesToBase64 and base64ToBytes', () => {
    it('should convert bytes to base64 and back', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 0]);
      const base64 = bytesToBase64(original);
      const restored = base64ToBytes(base64);

      expect(restored).toEqual(original);
    });

    it('should handle empty arrays', () => {
      const original = new Uint8Array([]);
      const base64 = bytesToBase64(original);
      const restored = base64ToBytes(base64);

      expect(restored).toEqual(original);
    });

    it('should work with ArrayBuffer', () => {
      const arrayBuffer = new Uint8Array([10, 20, 30]).buffer;
      const base64 = bytesToBase64(arrayBuffer);
      const restored = base64ToBytes(base64);

      expect(restored).toEqual(new Uint8Array([10, 20, 30]));
    });
  });

  describe('deriveWrappingKey', () => {
    it('should derive a wrapping key from WebAuthn secret', async () => {
      const secret = crypto.getRandomValues(new Uint8Array(32)).buffer;
      const salt = generateWrappingSalt();

      const key = await deriveWrappingKey(secret, salt);

      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.type).toBe('secret');
      expect(key.usages).toContain('wrapKey');
      expect(key.usages).toContain('unwrapKey');
    });

    it('should derive the same key from the same inputs', async () => {
      const secret = crypto.getRandomValues(new Uint8Array(32)).buffer;
      const salt = generateWrappingSalt();

      const key1 = await deriveWrappingKey(secret, salt);
      const key2 = await deriveWrappingKey(secret, salt);

      // Keys should be functionally equivalent
      // We can't compare CryptoKeys directly, but we can test they produce same results
      const testData = crypto.getRandomValues(new Uint8Array(32));
      const ivArray = generateIV();
      const iv = ivArray.buffer as ArrayBuffer;

      const encrypted1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        testData
      );
      const encrypted2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key2,
        testData
      );

      // Should produce same encryption (with same IV)
      expect(new Uint8Array(encrypted1)).toEqual(new Uint8Array(encrypted2));
    });

    it('should derive different keys from different salts', async () => {
      const secret = crypto.getRandomValues(new Uint8Array(32)).buffer;
      const salt1 = generateWrappingSalt();
      const salt2 = generateWrappingSalt();

      const key1 = await deriveWrappingKey(secret, salt1);
      const key2 = await deriveWrappingKey(secret, salt2);

      // Keys should produce different encryptions
      const testData = crypto.getRandomValues(new Uint8Array(32));
      const ivArray = generateIV();
      const iv = ivArray.buffer as ArrayBuffer;

      const encrypted1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        testData
      );
      const encrypted2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key2,
        testData
      );

      expect(new Uint8Array(encrypted1)).not.toEqual(new Uint8Array(encrypted2));
    });
  });

  describe('wrapKey and unwrapKey', () => {
    it('should wrap and unwrap a key successfully', async () => {
      // Create a test encryption key
      const encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Create a wrapping key
      const webauthnSecret = crypto.getRandomValues(new Uint8Array(32)).buffer;
      const salt = generateWrappingSalt();
      const wrappingKey = await deriveWrappingKey(webauthnSecret, salt);

      // Wrap the encryption key
      const iv = generateIV();
      const wrappedKey = await wrapKey(encryptionKey, wrappingKey, iv);

      expect(wrappedKey).toBeInstanceOf(ArrayBuffer);
      expect(wrappedKey.byteLength).toBeGreaterThan(0);

      // Unwrap the key
      const unwrappedKey = await unwrapKey(wrappedKey, wrappingKey, iv);

      expect(unwrappedKey).toBeInstanceOf(CryptoKey);
      expect(unwrappedKey.type).toBe('secret');
      expect(unwrappedKey.usages).toContain('encrypt');
      expect(unwrappedKey.usages).toContain('decrypt');

      // Verify the unwrapped key works the same as original
      const testData = new TextEncoder().encode('test data');
      const testIvArray = generateIV();
      const testIv = testIvArray.buffer as ArrayBuffer;

      const encrypted1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: testIv },
        encryptionKey,
        testData
      );
      const encrypted2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: testIv },
        unwrappedKey,
        testData
      );

      expect(new Uint8Array(encrypted1)).toEqual(new Uint8Array(encrypted2));
    });

    it('should fail to unwrap with wrong wrapping key', async () => {
      const encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Wrap with one key
      const secret1 = crypto.getRandomValues(new Uint8Array(32)).buffer;
      const salt1 = generateWrappingSalt();
      const wrappingKey1 = await deriveWrappingKey(secret1, salt1);
      const iv = generateIV();
      const wrappedKey = await wrapKey(encryptionKey, wrappingKey1, iv);

      // Try to unwrap with different key
      const secret2 = crypto.getRandomValues(new Uint8Array(32)).buffer;
      const salt2 = generateWrappingSalt();
      const wrappingKey2 = await deriveWrappingKey(secret2, salt2);

      await expect(unwrapKey(wrappedKey, wrappingKey2, iv)).rejects.toThrow();
    });

    it('should fail to unwrap with wrong IV', async () => {
      const encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const secret = crypto.getRandomValues(new Uint8Array(32)).buffer;
      const salt = generateWrappingSalt();
      const wrappingKey = await deriveWrappingKey(secret, salt);

      const iv1 = generateIV();
      const wrappedKey = await wrapKey(encryptionKey, wrappingKey, iv1);

      const iv2 = generateIV();
      await expect(unwrapKey(wrappedKey, wrappingKey, iv2)).rejects.toThrow();
    });
  });
});
