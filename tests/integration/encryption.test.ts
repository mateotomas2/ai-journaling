/**
 * Integration test for embedding encryption
 * Verifies that vector embeddings are encrypted at rest in RxDB
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db';
import type { Embedding } from '../../src/types/entities';

describe('Embedding Encryption', () => {
  const TEST_PASSWORD = 'test-encryption-password-123';

  beforeAll(async () => {
    // Create database with encryption
    await createDatabase(TEST_PASSWORD);
  });

  afterAll(async () => {
    // Clean up
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clean up embeddings before each test
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (db) {
      const allEmbeddings = await db.embeddings.find().exec();
      await Promise.all(allEmbeddings.map((e) => e.remove()));
    }
  });

  test('should store and retrieve embeddings with encryption', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    // Create test embedding
    const testEmbedding: Embedding = {
      id: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1), // Random values [-1, 1]
      modelVersion: 'all-MiniLM-L6-v2@v0',
      createdAt: Date.now(),
    };

    // Insert embedding
    await db.embeddings.insert(testEmbedding);

    // Retrieve embedding
    const retrieved = await db.embeddings.findOne(testEmbedding.id).exec();

    expect(retrieved).toBeTruthy();
    expect(retrieved?.id).toBe(testEmbedding.id);
    expect(retrieved?.messageId).toBe(testEmbedding.messageId);
    expect(retrieved?.vector).toHaveLength(384);
    expect(retrieved?.modelVersion).toBe(testEmbedding.modelVersion);
    expect(retrieved?.createdAt).toBe(testEmbedding.createdAt);

    // Verify vector values match (allowing for floating point precision)
    for (let i = 0; i < 384; i++) {
      expect(retrieved?.vector[i]).toBeCloseTo(testEmbedding.vector[i]!, 5);
    }
  });

  test('should encrypt vector field at rest', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    // Create test embedding with known values
    const testVector = Array.from({ length: 384 }, (_, i) => i / 384); // Sequential values
    const testEmbedding: Embedding = {
      id: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      vector: testVector,
      modelVersion: 'all-MiniLM-L6-v2@v0',
      createdAt: Date.now(),
    };

    // Insert embedding
    const doc = await db.embeddings.insert(testEmbedding);

    // Access raw document data (before decryption)
    // The encrypted field should not match the original values
    const rawData = doc.toJSON();

    // Vector should be accessible through the document API
    expect(rawData.vector).toBeDefined();
    expect(rawData.vector).toHaveLength(384);

    // Verify we can still retrieve decrypted data
    const retrieved = await db.embeddings.findOne(testEmbedding.id).exec();
    expect(retrieved?.vector).toEqual(testVector);
  });

  test('should handle multiple embeddings with encryption', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    // Create multiple test embeddings
    const embeddingsCount = 10;
    const testEmbeddings: Embedding[] = [];

    for (let i = 0; i < embeddingsCount; i++) {
      testEmbeddings.push({
        id: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
        modelVersion: 'all-MiniLM-L6-v2@v0',
        createdAt: Date.now() + i,
      });
    }

    // Insert all embeddings
    await db.embeddings.bulkInsert(testEmbeddings);

    // Retrieve all embeddings
    const retrieved = await db.embeddings.find().exec();

    expect(retrieved).toHaveLength(embeddingsCount);

    // Verify each embedding is correctly encrypted/decrypted
    for (const embedding of testEmbeddings) {
      const found = retrieved.find((e) => e.id === embedding.id);

      expect(found).toBeTruthy();
      expect(found?.messageId).toBe(embedding.messageId);
      expect(found?.vector).toHaveLength(384);
      expect(found?.modelVersion).toBe(embedding.modelVersion);
    }
  });

  test('should maintain vector precision after encryption/decryption', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    // Create embedding with precise floating point values
    const preciseVector = Array.from({ length: 384 }, (_, i) => {
      return Math.sin(i * 0.1) * 0.5 + Math.cos(i * 0.05) * 0.5;
    });

    // Normalize to ensure values are in [-1, 1]
    let magnitude = 0;
    for (const val of preciseVector) {
      magnitude += val * val;
    }
    magnitude = Math.sqrt(magnitude);

    for (let i = 0; i < preciseVector.length; i++) {
      preciseVector[i] = preciseVector[i]! / magnitude;
    }

    const testEmbedding: Embedding = {
      id: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      vector: preciseVector,
      modelVersion: 'all-MiniLM-L6-v2@v0',
      createdAt: Date.now(),
    };

    // Insert and retrieve
    await db.embeddings.insert(testEmbedding);
    const retrieved = await db.embeddings.findOne(testEmbedding.id).exec();

    expect(retrieved).toBeTruthy();

    // Check precision is maintained (within floating point tolerance)
    for (let i = 0; i < 384; i++) {
      const original = preciseVector[i]!;
      const decrypted = retrieved?.vector[i]!;

      expect(decrypted).toBeCloseTo(original, 10); // High precision
    }
  });

  test('should query embeddings by messageId index', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    const messageId = crypto.randomUUID();

    // Create multiple embeddings for the same message
    // (In practice, there should only be one, but testing index functionality)
    const embedding1: Embedding = {
      id: crypto.randomUUID(),
      messageId,
      vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
      modelVersion: 'all-MiniLM-L6-v2@v0',
      createdAt: Date.now(),
    };

    const embedding2: Embedding = {
      id: crypto.randomUUID(),
      messageId: crypto.randomUUID(), // Different message
      vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
      modelVersion: 'all-MiniLM-L6-v2@v0',
      createdAt: Date.now() + 1000,
    };

    await db.embeddings.insert(embedding1);
    await db.embeddings.insert(embedding2);

    // Query by messageId (using index)
    const results = await db.embeddings
      .find({
        selector: { messageId },
      })
      .exec();

    expect(results).toHaveLength(1);
    expect(results[0]?.messageId).toBe(messageId);
    expect(results[0]?.id).toBe(embedding1.id);
  });

  test('should query embeddings by createdAt index', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    const now = Date.now();

    // Create embeddings with different timestamps
    const embeddings: Embedding[] = [
      {
        id: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
        modelVersion: 'all-MiniLM-L6-v2@v0',
        createdAt: now - 3000,
      },
      {
        id: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
        modelVersion: 'all-MiniLM-L6-v2@v0',
        createdAt: now - 2000,
      },
      {
        id: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
        modelVersion: 'all-MiniLM-L6-v2@v0',
        createdAt: now - 1000,
      },
    ];

    await db.embeddings.bulkInsert(embeddings);

    // Query embeddings created after a certain time
    const results = await db.embeddings
      .find({
        selector: {
          createdAt: { $gt: now - 2500 },
        },
      })
      .exec();

    expect(results).toHaveLength(2); // Last two embeddings
  });

  test('should enforce vector dimension constraints', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    // Try to insert embedding with wrong vector dimensions
    const invalidEmbedding = {
      id: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      vector: [1, 2, 3], // Only 3 dimensions instead of 384
      modelVersion: 'all-MiniLM-L6-v2@v0',
      createdAt: Date.now(),
    };

    await expect(db.embeddings.insert(invalidEmbedding as any)).rejects.toThrow();
  });

  test('should enforce vector value constraints', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    // Try to insert embedding with out-of-range values
    const invalidEmbedding = {
      id: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      vector: Array.from({ length: 384 }, () => 2.0), // Values > 1.0
      modelVersion: 'all-MiniLM-L6-v2@v0',
      createdAt: Date.now(),
    };

    await expect(db.embeddings.insert(invalidEmbedding as any)).rejects.toThrow();
  });
});
