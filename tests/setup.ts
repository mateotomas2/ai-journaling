import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock IndexedDB for RxDB
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn().mockResolvedValue([]),
};

Object.defineProperty(globalThis, 'indexedDB', {
  value: indexedDB,
  writable: true,
});

// Mock crypto with working implementations for encryption tests
const mockCrypto = {
  getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
    const bytes = arr as unknown as Uint8Array;
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: (): `${string}-${string}-${string}-${string}-${string}` => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as `${string}-${string}-${string}-${string}-${string}`;
  },
  subtle: {
    // Simple XOR-based mock encryption for testing
    encrypt: vi.fn().mockImplementation(
      async (
        _algorithm: { name: string; iv: Uint8Array },
        _key: CryptoKey,
        data: BufferSource
      ): Promise<ArrayBuffer> => {
        // Simple mock: just return data as ArrayBuffer
        const dataArray = new Uint8Array(
          data instanceof ArrayBuffer ? data : (data as Uint8Array).buffer
        );
        // Return a copy to avoid shared buffer issues
        const result = new ArrayBuffer(dataArray.length);
        new Uint8Array(result).set(dataArray);
        return result;
      }
    ),

    decrypt: vi.fn().mockImplementation(
      async (
        _algorithm: { name: string; iv: Uint8Array },
        _key: CryptoKey,
        data: BufferSource
      ): Promise<ArrayBuffer> => {
        // Simple mock: just return data as ArrayBuffer
        const dataArray = new Uint8Array(
          data instanceof ArrayBuffer ? data : (data as Uint8Array).buffer
        );
        // Return a copy to avoid shared buffer issues
        const result = new ArrayBuffer(dataArray.length);
        new Uint8Array(result).set(dataArray);
        return result;
      }
    ),

    deriveKey: vi.fn().mockImplementation(
      async (): Promise<CryptoKey> => {
        // Return a mock CryptoKey
        return {
          type: 'secret',
          extractable: true,
          algorithm: { name: 'AES-GCM', length: 256 },
          usages: ['encrypt', 'decrypt'],
        } as CryptoKey;
      }
    ),

    importKey: vi.fn().mockImplementation(
      async (): Promise<CryptoKey> => {
        // Return a mock CryptoKey
        return {
          type: 'secret',
          extractable: false,
          algorithm: { name: 'PBKDF2' },
          usages: ['deriveBits', 'deriveKey'],
        } as CryptoKey;
      }
    ),

    exportKey: vi.fn().mockImplementation(
      async (_format: string, _key: CryptoKey): Promise<ArrayBuffer> => {
        // Return mock 32-byte key
        const mockKey = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          mockKey[i] = i;
        }
        return mockKey.buffer;
      }
    ),

    digest: vi.fn().mockImplementation(
      async (_algorithm: string, data: BufferSource): Promise<ArrayBuffer> => {
        // Simple mock hash - just return first 32 bytes or padded
        const dataArray = new Uint8Array(
          data instanceof ArrayBuffer ? data : (data as Uint8Array).buffer
        );
        const hash = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          hash[i] = dataArray[i % dataArray.length] || 0;
        }
        return hash.buffer;
      }
    ),
  },
};

Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true,
});

/**
 * Creates a mock embedding with the new schema format
 */
export function createMockEmbedding(overrides: {
  id?: string;
  entityType?: 'message' | 'note';
  entityId?: string;
  messageId?: string; // Legacy, will be used as entityId if entityId not provided
  vector?: number[];
  modelVersion?: string;
  createdAt?: number;
} = {}): {
  id: string;
  entityType: 'message' | 'note';
  entityId: string;
  vector: number[];
  modelVersion: string;
  createdAt: number;
} {
  const id = overrides.id ?? crypto.randomUUID();
  const entityType = overrides.entityType ?? 'message';
  const entityId = overrides.entityId ?? overrides.messageId ?? crypto.randomUUID();
  const vector = overrides.vector ?? Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  const modelVersion = overrides.modelVersion ?? 'all-MiniLM-L6-v2@v0';
  const createdAt = overrides.createdAt ?? Date.now();

  return {
    id,
    entityType,
    entityId,
    vector,
    modelVersion,
    createdAt,
  };
}
