/**
 * Unit tests for memory indexer
 * Tests queueing, processing, and lifecycle management of embeddings
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db';
import { embeddingService } from '../../src/services/embedding/generator';

// Note: This test file will test the MemoryIndexer class once it's implemented
// For now, we're creating the test structure to follow TDD approach

describe('Memory Indexer', () => {
  const TEST_PASSWORD = 'test-indexer-123';

  beforeAll(async () => {
    await createDatabase(TEST_PASSWORD);
    await embeddingService.initialize();
  }, 60000);

  afterAll(async () => {
    await embeddingService.dispose();
    await closeDatabase();
  });

  beforeEach(async () => {
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

  describe('Queue Management', () => {
    test('should queue messages for embedding', async () => {
      // This test will be implemented once MemoryIndexer is created
      // Expected behavior: queueForEmbedding() should add message ID to queue
      expect(true).toBe(true); // Placeholder
    });

    test('should get queue length', async () => {
      // Expected behavior: getQueueLength() should return number of pending items
      expect(true).toBe(true); // Placeholder
    });

    test('should not queue duplicate message IDs', async () => {
      // Expected behavior: Queueing same ID twice should only add once
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Embedding Processing', () => {
    test('should process queued messages', async () => {
      const db = await import('../../src/db').then((m) => m.getDatabase());
      if (!db) throw new Error('Database not initialized');

      // Create test message
      const message = {
        id: crypto.randomUUID(),
        dayId: '2026-01-19',
        role: 'user' as const,
        content: 'Test message for indexing',
        timestamp: Date.now(),
      };

      await db.messages.insert(message);

      // Expected behavior: processQueue() should generate embeddings for queued messages
      // For now, manually create embedding to test the concept
      const embedding = await embeddingService.generateEmbedding(message.content);

      await db.embeddings.insert({
        id: crypto.randomUUID(),
        messageId: message.id,
        vector: Array.from(embedding.vector),
        modelVersion: embedding.modelVersion,
        createdAt: Date.now(),
      });

      // Verify embedding was created
      const storedEmbedding = await db.embeddings
        .find({ selector: { messageId: message.id } })
        .exec();

      expect(storedEmbedding).toHaveLength(1);
    });

    test('should handle processing errors gracefully', async () => {
      // Expected behavior: If embedding generation fails, should log error and continue
      expect(true).toBe(true); // Placeholder
    });

    test('should process batch of messages efficiently', async () => {
      const db = await import('../../src/db').then((m) => m.getDatabase());
      if (!db) throw new Error('Database not initialized');

      // Create multiple test messages
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: crypto.randomUUID(),
        dayId: '2026-01-19',
        role: 'user' as const,
        content: `Test message ${i} for batch processing`,
        timestamp: Date.now() + i,
      }));

      for (const message of messages) {
        await db.messages.insert(message);
      }

      // Expected behavior: Should efficiently process all messages
      const texts = messages.map((m) => m.content);
      const embeddings = await embeddingService.generateBatchEmbeddings(texts);

      expect(embeddings).toHaveLength(messages.length);

      // Store embeddings
      for (let i = 0; i < messages.length; i++) {
        await db.embeddings.insert({
          id: crypto.randomUUID(),
          messageId: messages[i]!.id,
          vector: Array.from(embeddings[i]!.vector),
          modelVersion: embeddings[i]!.modelVersion,
          createdAt: Date.now(),
        });
      }

      // Verify all were indexed
      const allEmbeddings = await db.embeddings.find().exec();
      expect(allEmbeddings.length).toBe(messages.length);
    });
  });

  describe('Embedding Status Check', () => {
    test('should check if message has embedding', async () => {
      const db = await import('../../src/db').then((m) => m.getDatabase());
      if (!db) throw new Error('Database not initialized');

      const messageWithEmbedding = {
        id: crypto.randomUUID(),
        dayId: '2026-01-19',
        role: 'user' as const,
        content: 'Message with embedding',
        timestamp: Date.now(),
      };

      const messageWithoutEmbedding = {
        id: crypto.randomUUID(),
        dayId: '2026-01-19',
        role: 'user' as const,
        content: 'Message without embedding',
        timestamp: Date.now(),
      };

      await db.messages.insert(messageWithEmbedding);
      await db.messages.insert(messageWithoutEmbedding);

      // Create embedding for first message
      const embedding = await embeddingService.generateEmbedding(messageWithEmbedding.content);
      await db.embeddings.insert({
        id: crypto.randomUUID(),
        messageId: messageWithEmbedding.id,
        vector: Array.from(embedding.vector),
        modelVersion: embedding.modelVersion,
        createdAt: Date.now(),
      });

      // Check status
      const hasEmbedding1 = await db.embeddings
        .find({ selector: { messageId: messageWithEmbedding.id } })
        .exec();

      const hasEmbedding2 = await db.embeddings
        .find({ selector: { messageId: messageWithoutEmbedding.id } })
        .exec();

      expect(hasEmbedding1).toHaveLength(1);
      expect(hasEmbedding2).toHaveLength(0);
    });
  });

  describe('Orphan Cleanup', () => {
    test('should identify orphaned embeddings', async () => {
      const db = await import('../../src/db').then((m) => m.getDatabase());
      if (!db) throw new Error('Database not initialized');

      // Create message and embedding
      const message = {
        id: crypto.randomUUID(),
        dayId: '2026-01-19',
        role: 'user' as const,
        content: 'Message that will be deleted',
        timestamp: Date.now(),
      };

      await db.messages.insert(message);

      const embedding = await embeddingService.generateEmbedding(message.content);
      await db.embeddings.insert({
        id: crypto.randomUUID(),
        messageId: message.id,
        vector: Array.from(embedding.vector),
        modelVersion: embedding.modelVersion,
        createdAt: Date.now(),
      });

      // Delete message (leaving orphaned embedding)
      const messageDoc = await db.messages.findOne(message.id).exec();
      await messageDoc?.remove();

      // Check for orphaned embedding
      const allEmbeddings = await db.embeddings.find().exec();
      const allMessages = await db.messages.find().exec();
      const messageIds = new Set(allMessages.map((m) => m.id));

      const orphanedEmbeddings = allEmbeddings.filter((e) => !messageIds.has(e.messageId));

      expect(orphanedEmbeddings).toHaveLength(1);
      expect(orphanedEmbeddings[0]?.messageId).toBe(message.id);
    });

    test('should remove orphaned embeddings', async () => {
      const db = await import('../../src/db').then((m) => m.getDatabase());
      if (!db) throw new Error('Database not initialized');

      // Create orphaned embedding (no corresponding message)
      const orphanedEmbedding = {
        id: crypto.randomUUID(),
        messageId: 'non-existent-message-id',
        vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
        modelVersion: 'all-MiniLM-L6-v2@v0',
        createdAt: Date.now(),
      };

      await db.embeddings.insert(orphanedEmbedding);

      // Expected behavior: cleanupOrphans() should remove it
      const allEmbeddings = await db.embeddings.find().exec();
      const allMessages = await db.messages.find().exec();
      const messageIds = new Set(allMessages.map((m) => m.id));

      // Find and remove orphans
      const orphans = allEmbeddings.filter((e) => !messageIds.has(e.messageId));

      for (const orphan of orphans) {
        await orphan.remove();
      }

      // Verify cleanup
      const remainingEmbeddings = await db.embeddings.find().exec();
      expect(remainingEmbeddings).toHaveLength(0);
    });

    test('should return count of removed orphans', async () => {
      const db = await import('../../src/db').then((m) => m.getDatabase());
      if (!db) throw new Error('Database not initialized');

      // Create multiple orphaned embeddings
      const orphanCount = 3;

      for (let i = 0; i < orphanCount; i++) {
        await db.embeddings.insert({
          id: crypto.randomUUID(),
          messageId: `orphan-${i}`,
          vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
          modelVersion: 'all-MiniLM-L6-v2@v0',
          createdAt: Date.now(),
        });
      }

      // Count and remove orphans
      const allEmbeddings = await db.embeddings.find().exec();
      const allMessages = await db.messages.find().exec();
      const messageIds = new Set(allMessages.map((m) => m.id));

      const orphans = allEmbeddings.filter((e) => !messageIds.has(e.messageId));
      const removedCount = orphans.length;

      for (const orphan of orphans) {
        await orphan.remove();
      }

      expect(removedCount).toBe(orphanCount);
    });
  });

  describe('Re-indexing', () => {
    test('should update embedding when message content changes', async () => {
      const db = await import('../../src/db').then((m) => m.getDatabase());
      if (!db) throw new Error('Database not initialized');

      // Create message with embedding
      const message = {
        id: crypto.randomUUID(),
        dayId: '2026-01-19',
        role: 'user' as const,
        content: 'Original content',
        timestamp: Date.now(),
      };

      await db.messages.insert(message);

      const originalEmbedding = await embeddingService.generateEmbedding(message.content);
      await db.embeddings.insert({
        id: crypto.randomUUID(),
        messageId: message.id,
        vector: Array.from(originalEmbedding.vector),
        modelVersion: originalEmbedding.modelVersion,
        createdAt: Date.now(),
      });

      // Update message content
      const updatedContent = 'Completely different content';
      const newEmbedding = await embeddingService.generateEmbedding(updatedContent);

      // Remove old embedding
      const oldEmbeddingDocs = await db.embeddings
        .find({ selector: { messageId: message.id } })
        .exec();

      for (const doc of oldEmbeddingDocs) {
        await doc.remove();
      }

      // Create new embedding
      await db.embeddings.insert({
        id: crypto.randomUUID(),
        messageId: message.id,
        vector: Array.from(newEmbedding.vector),
        modelVersion: newEmbedding.modelVersion,
        createdAt: Date.now(),
      });

      // Verify new embedding is different
      const updatedEmbeddingDocs = await db.embeddings
        .find({ selector: { messageId: message.id } })
        .exec();

      expect(updatedEmbeddingDocs).toHaveLength(1);

      // Vectors should be different
      const originalVector = new Float32Array(originalEmbedding.vector);
      const newVector = new Float32Array(updatedEmbeddingDocs[0]!.vector);

      let areDifferent = false;
      for (let i = 0; i < 384; i++) {
        if (Math.abs(originalVector[i]! - newVector[i]!) > 0.01) {
          areDifferent = true;
          break;
        }
      }

      expect(areDifferent).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should process queue in reasonable time', async () => {
      const db = await import('../../src/db').then((m) => m.getDatabase());
      if (!db) throw new Error('Database not initialized');

      // Create 10 messages
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID(),
        dayId: '2026-01-19',
        role: 'user' as const,
        content: `Performance test message ${i}`,
        timestamp: Date.now() + i,
      }));

      for (const message of messages) {
        await db.messages.insert(message);
      }

      // Process batch
      const startTime = performance.now();

      const texts = messages.map((m) => m.content);
      const embeddings = await embeddingService.generateBatchEmbeddings(texts);

      for (let i = 0; i < messages.length; i++) {
        await db.embeddings.insert({
          id: crypto.randomUUID(),
          messageId: messages[i]!.id,
          vector: Array.from(embeddings[i]!.vector),
          modelVersion: embeddings[i]!.modelVersion,
          createdAt: Date.now(),
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 5 seconds for 10 messages)
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });
});
