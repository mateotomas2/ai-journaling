/**
 * Memory Indexer
 * Manages the lifecycle of embeddings: queueing, processing, and cleanup
 */

import type { IMemoryIndexer } from '../../../specs/006-vector-memory/contracts/memory-service';
import { embeddingService } from '../embedding/generator';
import { getDatabase } from '../../db';

const QUEUE_STORAGE_KEY = 'memory-indexer-queue';

class MemoryIndexer implements IMemoryIndexer {
  private queue: Set<string> = new Set();
  private isProcessing: boolean = false;

  constructor() {
    // Restore queue from localStorage on initialization
    this.restoreQueue();
  }

  /**
   * Save queue to localStorage for persistence
   */
  private saveQueue(): void {
    try {
      const queueArray = Array.from(this.queue);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queueArray));
    } catch (error) {
      console.warn('[MemoryIndexer] Failed to save queue to localStorage:', error);
    }
  }

  /**
   * Restore queue from localStorage
   */
  private restoreQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const queueArray = JSON.parse(stored) as string[];
        this.queue = new Set(queueArray);
        console.log(`[MemoryIndexer] Restored ${this.queue.size} items from persisted queue`);
      }
    } catch (error) {
      console.warn('[MemoryIndexer] Failed to restore queue from localStorage:', error);
    }
  }

  /**
   * Clear persisted queue
   */
  private clearPersistedQueue(): void {
    try {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    } catch (error) {
      console.warn('[MemoryIndexer] Failed to clear persisted queue:', error);
    }
  }

  /**
   * Queue a message for embedding generation
   */
  queueForEmbedding(messageId: string): void {
    this.queue.add(messageId);
    this.saveQueue(); // Persist after adding
    console.log(`[MemoryIndexer] Queued message ${messageId} for embedding (queue size: ${this.queue.size})`);
  }

  /**
   * Get count of messages in embedding queue
   */
  getQueueLength(): number {
    return this.queue.size;
  }

  /**
   * Process the embedding queue
   * Generates embeddings for all queued messages
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[MemoryIndexer] Queue processing already in progress');
      return;
    }

    if (this.queue.size === 0) {
      console.log('[MemoryIndexer] Queue is empty, nothing to process');
      return;
    }

    this.isProcessing = true;

    try {
      const db = await getDatabase();
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Ensure embedding service is ready
      const status = embeddingService.getStatus();
      if (!status.isReady) {
        console.log('[MemoryIndexer] Embedding service not ready yet. Deferring queue processing.');
        console.log('[MemoryIndexer] Queue will be processed when embedding service is initialized for search.');
        // Don't process the queue yet - wait for the service to be initialized by a search operation
        this.isProcessing = false;
        return;
      }

      console.log(`[MemoryIndexer] Processing ${this.queue.size} messages...`);

      const messageIds = Array.from(this.queue);
      const processedCount = { success: 0, failed: 0, skipped: 0 };

      // Process messages one by one (could be optimized with batching later)
      for (const messageId of messageIds) {
        try {
          // Check if message already has embedding
          const existingEmbedding = await db.embeddings
            .find({
              selector: { messageId },
            })
            .exec();

          if (existingEmbedding.length > 0) {
            console.log(`[MemoryIndexer] Message ${messageId} already has embedding, skipping`);
            this.queue.delete(messageId);
            processedCount.skipped++;
            continue;
          }

          // Fetch message content
          const message = await db.messages.findOne(messageId).exec();

          if (!message) {
            console.warn(`[MemoryIndexer] Message ${messageId} not found, removing from queue`);
            this.queue.delete(messageId);
            processedCount.skipped++;
            continue;
          }

          // Generate embedding
          const embeddingResult = await embeddingService.generateEmbedding(message.content);

          // Store embedding
          await db.embeddings.insert({
            id: crypto.randomUUID(),
            messageId: message.id,
            vector: Array.from(embeddingResult.vector),
            modelVersion: embeddingResult.modelVersion,
            createdAt: Date.now(),
          });

          console.log(
            `[MemoryIndexer] Generated embedding for message ${messageId} (${embeddingResult.processingTimeMs.toFixed(0)}ms)`
          );

          this.queue.delete(messageId);
          this.saveQueue(); // Persist after removing
          processedCount.success++;
        } catch (error) {
          console.error(`[MemoryIndexer] Failed to process message ${messageId}:`, error);
          // Keep in queue for retry, but don't block other messages
          processedCount.failed++;
        }
      }

      // Clear persisted queue if empty
      if (this.queue.size === 0) {
        this.clearPersistedQueue();
      }

      console.log(
        `[MemoryIndexer] Queue processing complete: ${processedCount.success} succeeded, ${processedCount.failed} failed, ${processedCount.skipped} skipped`
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process messages in batches for better performance
   * Useful for initial indexing of many messages
   */
  async processBatch(messageIds: string[], batchSize: number = 10): Promise<void> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    console.log(`[MemoryIndexer] Starting batch processing for ${messageIds.length} messages (batch size: ${batchSize})`);

    const totalBatches = Math.ceil(messageIds.length / batchSize);
    let processedCount = 0;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batchIds = messageIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`[MemoryIndexer] Processing batch ${batchNumber}/${totalBatches}...`);

      try {
        // Fetch all messages in batch
        const messages = await db.messages
          .find({
            selector: {
              id: { $in: batchIds },
            },
          })
          .exec();

        if (messages.length === 0) {
          console.warn(`[MemoryIndexer] No messages found for batch ${batchNumber}`);
          continue;
        }

        // Extract text content
        const texts = messages.map((m) => m.content);
        const messageMap = new Map(messages.map((m) => [m.content, m.id]));

        // Generate embeddings in batch
        const embeddingResults = await embeddingService.generateBatchEmbeddings(texts);

        // Store embeddings
        for (let j = 0; j < embeddingResults.length; j++) {
          const result = embeddingResults[j];
          const text = texts[j];
          const messageId = messageMap.get(text!);

          if (!result || !messageId) {
            console.warn(`[MemoryIndexer] Skipping batch result ${j} - missing data`);
            continue;
          }

          try {
            await db.embeddings.insert({
              id: crypto.randomUUID(),
              messageId,
              vector: Array.from(result.vector),
              modelVersion: result.modelVersion,
              createdAt: Date.now(),
            });

            processedCount++;
          } catch (insertError) {
            console.error(`[MemoryIndexer] Failed to insert embedding for message ${messageId}:`, insertError);
          }
        }

        console.log(`[MemoryIndexer] Batch ${batchNumber}/${totalBatches} complete (${messages.length} messages)`);
      } catch (batchError) {
        console.error(`[MemoryIndexer] Failed to process batch ${batchNumber}:`, batchError);
      }
    }

    console.log(`[MemoryIndexer] Batch processing complete: ${processedCount} embeddings generated`);
  }

  /**
   * Check if a message has a valid embedding
   */
  async hasEmbedding(messageId: string): Promise<boolean> {
    const db = await getDatabase();
    if (!db) {
      return false;
    }

    const embeddings = await db.embeddings
      .find({
        selector: { messageId },
      })
      .exec();

    return embeddings.length > 0;
  }

  /**
   * Clean up orphaned embeddings
   * Removes embeddings for deleted messages
   * @returns Number of embeddings removed
   */
  async cleanupOrphans(): Promise<number> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    console.log('[MemoryIndexer] Starting orphan cleanup...');

    // Fetch all embeddings and messages
    const allEmbeddings = await db.embeddings.find().exec();
    const allMessages = await db.messages.find().exec();

    // Create set of valid message IDs
    const validMessageIds = new Set(allMessages.map((m) => m.id));

    // Find orphaned embeddings
    const orphanedEmbeddings = allEmbeddings.filter((e) => !validMessageIds.has(e.messageId));

    console.log(`[MemoryIndexer] Found ${orphanedEmbeddings.length} orphaned embeddings`);

    // Remove orphaned embeddings
    for (const orphan of orphanedEmbeddings) {
      try {
        await orphan.remove();
        console.log(`[MemoryIndexer] Removed orphaned embedding for message ${orphan.messageId}`);
      } catch (error) {
        console.error(`[MemoryIndexer] Failed to remove orphaned embedding:`, error);
      }
    }

    console.log(`[MemoryIndexer] Cleanup complete: removed ${orphanedEmbeddings.length} orphaned embeddings`);

    return orphanedEmbeddings.length;
  }

  /**
   * Index a single message immediately (bypasses queue)
   */
  async indexMessageImmediate(messageId: string): Promise<void> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Ensure embedding service is ready
    const status = embeddingService.getStatus();
    if (!status.isReady) {
      await embeddingService.initialize();
    }

    // Check if already has embedding
    const hasExisting = await this.hasEmbedding(messageId);
    if (hasExisting) {
      console.log(`[MemoryIndexer] Message ${messageId} already has embedding`);
      return;
    }

    // Fetch message
    const message = await db.messages.findOne(messageId).exec();
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // Generate and store embedding
    const embeddingResult = await embeddingService.generateEmbedding(message.content);

    await db.embeddings.insert({
      id: crypto.randomUUID(),
      messageId: message.id,
      vector: Array.from(embeddingResult.vector),
      modelVersion: embeddingResult.modelVersion,
      createdAt: Date.now(),
    });

    console.log(`[MemoryIndexer] Indexed message ${messageId} immediately`);
  }

  /**
   * Re-index a message (removes old embedding and creates new one)
   */
  async reindexMessage(messageId: string): Promise<void> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Remove existing embeddings
    const existingEmbeddings = await db.embeddings
      .find({
        selector: { messageId },
      })
      .exec();

    for (const embedding of existingEmbeddings) {
      await embedding.remove();
    }

    console.log(`[MemoryIndexer] Removed ${existingEmbeddings.length} existing embeddings for message ${messageId}`);

    // Index with new embedding
    await this.indexMessageImmediate(messageId);
  }

  /**
   * Get statistics about indexing status
   */
  async getIndexingStats(): Promise<{
    queueSize: number;
    isProcessing: boolean;
    totalMessages: number;
    indexedMessages: number;
    pendingMessages: number;
  }> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    const allMessages = await db.messages.find().exec();
    const allEmbeddings = await db.embeddings.find().exec();

    const indexedMessageIds = new Set(allEmbeddings.map((e) => e.messageId));
    const pendingMessages = allMessages.filter((m) => !indexedMessageIds.has(m.id));

    return {
      queueSize: this.queue.size,
      isProcessing: this.isProcessing,
      totalMessages: allMessages.length,
      indexedMessages: allEmbeddings.length,
      pendingMessages: pendingMessages.length,
    };
  }

  /**
   * Clear the queue without processing
   */
  clearQueue(): void {
    const size = this.queue.size;
    this.queue.clear();
    console.log(`[MemoryIndexer] Cleared queue (${size} items removed)`);
  }
}

// Export singleton instance
export const memoryIndexer = new MemoryIndexer();
