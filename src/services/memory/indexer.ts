/**
 * Memory Indexer
 * Manages the lifecycle of embeddings: queueing, processing, and cleanup
 */

import type { IMemoryIndexer } from '../../../specs/006-vector-memory/contracts/memory-service';
import type { EmbeddingEntityType } from '../../types/entities';
import { embeddingService } from '../embedding/generator';
import { getDatabase } from '../../db';

const QUEUE_STORAGE_KEY = 'memory-indexer-queue';

/** Format: "entityType:entityId" */
type QueueItem = `${EmbeddingEntityType}:${string}`;

function parseQueueItem(item: string): { entityType: EmbeddingEntityType; entityId: string } | null {
  const [entityType, entityId] = item.split(':');
  if (entityType === 'message' || entityType === 'note') {
    return { entityType, entityId: entityId! };
  }
  // Legacy format: just messageId
  if (entityType && !entityId) {
    return { entityType: 'message', entityId: entityType };
  }
  return null;
}

function formatQueueItem(entityType: EmbeddingEntityType, entityId: string): QueueItem {
  return `${entityType}:${entityId}`;
}

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
   * Queue a message for embedding generation (legacy method)
   */
  queueForEmbedding(messageId: string): void {
    this.queueEntityForEmbedding('message', messageId);
  }

  /**
   * Queue an entity for embedding generation
   */
  queueEntityForEmbedding(entityType: EmbeddingEntityType, entityId: string): void {
    const queueItem = formatQueueItem(entityType, entityId);
    this.queue.add(queueItem);
    this.saveQueue(); // Persist after adding
    console.log(`[MemoryIndexer] Queued ${entityType} ${entityId} for embedding (queue size: ${this.queue.size})`);
  }

  /**
   * Get count of messages in embedding queue
   */
  getQueueLength(): number {
    return this.queue.size;
  }

  /**
   * Process the embedding queue
   * Generates embeddings for all queued entities (messages and notes)
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

      console.log(`[MemoryIndexer] Processing ${this.queue.size} entities...`);

      const queueItems = Array.from(this.queue);
      const processedCount = { success: 0, failed: 0, skipped: 0 };

      // Process entities one by one (could be optimized with batching later)
      for (const queueItem of queueItems) {
        const parsed = parseQueueItem(queueItem);
        if (!parsed) {
          console.warn(`[MemoryIndexer] Invalid queue item ${queueItem}, removing from queue`);
          this.queue.delete(queueItem);
          processedCount.skipped++;
          continue;
        }

        const { entityType, entityId } = parsed;

        try {
          // Check if entity already has embedding
          const existingEmbedding = await db.embeddings
            .find({
              selector: { entityType, entityId },
            })
            .exec();

          if (existingEmbedding.length > 0) {
            console.log(`[MemoryIndexer] ${entityType} ${entityId} already has embedding, skipping`);
            this.queue.delete(queueItem);
            processedCount.skipped++;
            continue;
          }

          // Fetch entity content based on type
          let content: string | null = null;

          if (entityType === 'message') {
            const message = await db.messages.findOne(entityId).exec();
            if (message) {
              content = message.content;
            }
          } else if (entityType === 'note') {
            const note = await db.notes.findOne(entityId).exec();
            if (note) {
              // Combine title and content for notes
              content = note.title ? `${note.title}\n\n${note.content}` : note.content;
            }
          }

          if (!content) {
            console.warn(`[MemoryIndexer] ${entityType} ${entityId} not found, removing from queue`);
            this.queue.delete(queueItem);
            processedCount.skipped++;
            continue;
          }

          // Generate embedding
          const embeddingResult = await embeddingService.generateEmbedding(content);

          // Store embedding with new schema
          await db.embeddings.insert({
            id: crypto.randomUUID(),
            entityType,
            entityId,
            vector: Array.from(embeddingResult.vector),
            modelVersion: embeddingResult.modelVersion,
            createdAt: Date.now(),
          });

          console.log(
            `[MemoryIndexer] Generated embedding for ${entityType} ${entityId} (${embeddingResult.processingTimeMs.toFixed(0)}ms)`
          );

          this.queue.delete(queueItem);
          this.saveQueue(); // Persist after removing
          processedCount.success++;
        } catch (error) {
          console.error(`[MemoryIndexer] Failed to process ${entityType} ${entityId}:`, error);
          // Keep in queue for retry, but don't block other entities
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
              entityType: 'message',
              entityId: messageId,
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
   * Check if a message has a valid embedding (legacy method)
   */
  async hasEmbedding(messageId: string): Promise<boolean> {
    return this.hasEntityEmbedding('message', messageId);
  }

  /**
   * Check if an entity has a valid embedding
   */
  async hasEntityEmbedding(entityType: EmbeddingEntityType, entityId: string): Promise<boolean> {
    const db = await getDatabase();
    if (!db) {
      return false;
    }

    const embeddings = await db.embeddings
      .find({
        selector: { entityType, entityId },
      })
      .exec();

    return embeddings.length > 0;
  }

  /**
   * Clean up orphaned embeddings
   * Removes embeddings for deleted messages and notes
   * @returns Number of embeddings removed
   */
  async cleanupOrphans(): Promise<number> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    console.log('[MemoryIndexer] Starting orphan cleanup...');

    // Fetch all embeddings, messages, and notes
    const allEmbeddings = await db.embeddings.find().exec();
    const allMessages = await db.messages.find().exec();
    const allNotes = await db.notes.find().exec();

    // Create sets of valid IDs
    const validMessageIds = new Set(allMessages.map((m) => m.id));
    const validNoteIds = new Set(allNotes.map((n) => n.id));

    // Find orphaned embeddings
    const orphanedEmbeddings = allEmbeddings.filter((e) => {
      if (e.entityType === 'message') {
        return !validMessageIds.has(e.entityId);
      } else if (e.entityType === 'note') {
        return !validNoteIds.has(e.entityId);
      }
      return true; // Remove embeddings with unknown entity types
    });

    console.log(`[MemoryIndexer] Found ${orphanedEmbeddings.length} orphaned embeddings`);

    // Remove orphaned embeddings
    for (const orphan of orphanedEmbeddings) {
      try {
        await orphan.remove();
        console.log(`[MemoryIndexer] Removed orphaned embedding for ${orphan.entityType} ${orphan.entityId}`);
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
    await this.indexEntityImmediate('message', messageId);
  }

  /**
   * Index a single note immediately (bypasses queue)
   */
  async indexNoteImmediate(noteId: string): Promise<void> {
    await this.indexEntityImmediate('note', noteId);
  }

  /**
   * Index a single entity immediately (bypasses queue)
   */
  async indexEntityImmediate(entityType: EmbeddingEntityType, entityId: string): Promise<void> {
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
    const hasExisting = await this.hasEntityEmbedding(entityType, entityId);
    if (hasExisting) {
      console.log(`[MemoryIndexer] ${entityType} ${entityId} already has embedding`);
      return;
    }

    // Fetch entity content
    let content: string | null = null;

    if (entityType === 'message') {
      const message = await db.messages.findOne(entityId).exec();
      if (message) {
        content = message.content;
      }
    } else if (entityType === 'note') {
      const note = await db.notes.findOne(entityId).exec();
      if (note) {
        content = note.title ? `${note.title}\n\n${note.content}` : note.content;
      }
    }

    if (!content) {
      throw new Error(`${entityType} ${entityId} not found`);
    }

    // Generate and store embedding
    const embeddingResult = await embeddingService.generateEmbedding(content);

    await db.embeddings.insert({
      id: crypto.randomUUID(),
      entityType,
      entityId,
      vector: Array.from(embeddingResult.vector),
      modelVersion: embeddingResult.modelVersion,
      createdAt: Date.now(),
    });

    console.log(`[MemoryIndexer] Indexed ${entityType} ${entityId} immediately`);
  }

  /**
   * Re-index a message (removes old embedding and creates new one)
   */
  async reindexMessage(messageId: string): Promise<void> {
    await this.reindexEntity('message', messageId);
  }

  /**
   * Re-index a note (removes old embedding and creates new one)
   */
  async reindexNote(noteId: string): Promise<void> {
    await this.reindexEntity('note', noteId);
  }

  /**
   * Re-index an entity (removes old embedding and creates new one)
   */
  async reindexEntity(entityType: EmbeddingEntityType, entityId: string): Promise<void> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Remove existing embeddings
    const existingEmbeddings = await db.embeddings
      .find({
        selector: { entityType, entityId },
      })
      .exec();

    for (const embedding of existingEmbeddings) {
      await embedding.remove();
    }

    console.log(`[MemoryIndexer] Removed ${existingEmbeddings.length} existing embeddings for ${entityType} ${entityId}`);

    // Index with new embedding
    await this.indexEntityImmediate(entityType, entityId);
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
    totalNotes: number;
    indexedNotes: number;
    pendingNotes: number;
  }> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    const allMessages = await db.messages.find().exec();
    const allNotes = await db.notes.find().exec();
    const allEmbeddings = await db.embeddings.find().exec();

    // Separate embeddings by entity type
    const messageEmbeddings = allEmbeddings.filter((e) => e.entityType === 'message');
    const noteEmbeddings = allEmbeddings.filter((e) => e.entityType === 'note');

    const indexedMessageIds = new Set(messageEmbeddings.map((e) => e.entityId));
    const indexedNoteIds = new Set(noteEmbeddings.map((e) => e.entityId));

    const pendingMessages = allMessages.filter((m) => !indexedMessageIds.has(m.id));
    const pendingNotes = allNotes.filter((n) => !indexedNoteIds.has(n.id));

    return {
      queueSize: this.queue.size,
      isProcessing: this.isProcessing,
      totalMessages: allMessages.length,
      indexedMessages: messageEmbeddings.length,
      pendingMessages: pendingMessages.length,
      totalNotes: allNotes.length,
      indexedNotes: noteEmbeddings.length,
      pendingNotes: pendingNotes.length,
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
