/**
 * Integration test for memory pipeline
 * Tests end-to-end flow: message → embedding → search → retrieval
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db';
import { embeddingService } from '../../src/services/embedding/generator';
import { memoryService } from '../../src/services/memory/search';
import { isMessageResult } from '../../specs/006-vector-memory/contracts/memory-service';
import type { Message } from '../../src/types/entities';

describe('Memory Pipeline Integration', () => {
  const TEST_PASSWORD = 'test-memory-pipeline-123';

  beforeAll(async () => {
    // Initialize database and embedding service
    await createDatabase(TEST_PASSWORD);
    await embeddingService.initialize();
  }, 60000); // 60s timeout for initialization

  afterAll(async () => {
    await embeddingService.dispose();
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clean up before each test
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (db) {
      const allMessages = await db.messages.find().exec();
      const allEmbeddings = await db.embeddings.find().exec();
      await Promise.all([
        ...allMessages.map((m) => m.remove()),
        ...allEmbeddings.map((e) => e.remove()),
      ]);
    }
  });

  test('should create embedding when message is indexed', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    // Create a test message
    const message: Message = {
      id: crypto.randomUUID(),
      dayId: '2026-01-19',
      role: 'user',
      content: 'I am feeling stressed about work deadlines',
      parts: JSON.stringify([{ type: 'text', content: 'I am feeling stressed about work deadlines' }]),
      timestamp: Date.now(),
    };

    await db.messages.insert(message);

    // Generate and store embedding
    const embedding = await embeddingService.generateEmbedding(message.content);

    await db.embeddings.insert({
      id: crypto.randomUUID(),
      entityType: 'message',
      entityId: message.id,
      vector: Array.from(embedding.vector),
      modelVersion: embedding.modelVersion,
      createdAt: Date.now(),
    });

    // Verify embedding was created
    const storedEmbedding = await db.embeddings
      .find({ selector: { entityType: 'message', entityId: message.id } })
      .exec();

    expect(storedEmbedding).toHaveLength(1);
    expect(storedEmbedding[0]?.vector).toHaveLength(384);
  });

  test('should handle search with date range filter', async () => {
    const db = await import('../../src/db').then((m) => m.getDatabase());
    if (!db) throw new Error('Database not initialized');

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    const messages = [
      {
        id: crypto.randomUUID(),
        dayId: '2026-01-16',
        role: 'user' as const,
        content: 'Old work stress entry',
        parts: JSON.stringify([{ type: 'text', content: 'Old work stress entry' }]),
        timestamp: threeDaysAgo,
      },
      {
        id: crypto.randomUUID(),
        dayId: '2026-01-18',
        role: 'user' as const,
        content: 'Recent work stress entry',
        parts: JSON.stringify([{ type: 'text', content: 'Recent work stress entry' }]),
        timestamp: oneDayAgo,
      },
    ];

    for (const message of messages) {
      await db.messages.insert(message);

      const embedding = await embeddingService.generateEmbedding(message.content);
      await db.embeddings.insert({
        id: crypto.randomUUID(),
        entityType: 'message',
        entityId: message.id,
        vector: Array.from(embedding.vector),
        modelVersion: embedding.modelVersion,
        createdAt: Date.now(),
      });
    }

    // Search with date filter (only 2026-01-17 onwards, should exclude the old entry)
    const results = await memoryService.search({
      query: 'work stress',
      dateRange: {
        startDate: '2026-01-17',
      },
    });

    // Should only include recent entry (dayId 2026-01-18)
    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      if (isMessageResult(result)) {
        expect(result.message.dayId >= '2026-01-17').toBe(true);
      }
    });
  });
});
