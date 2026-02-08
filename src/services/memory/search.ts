/**
 * Memory Search Service
 * Implements semantic similarity search across journal entries using vector embeddings
 */

import type {
  IMemoryService,
  MemorySearchQuery,
  MemorySearchResult,
  MemoryIndexStats,
  MessageSearchResult,
  NoteSearchResult,
} from '../../../specs/006-vector-memory/contracts/memory-service';
import type { Message, Note } from '../../types/entities';
import { embeddingService } from '../embedding/generator';
import { getDatabase } from '../../db';
import { memoryIndexer } from './indexer';
import { identifyRecurringThemes } from './analysis';
import { generateThemeInsights, getThemeSummary } from './patterns';
import type { RecurringTheme } from './analysis';
import type { PatternInsight } from './patterns';

/**
 * Metadata associated with a vector embedding
 */
export interface VectorMetadata {
  messageId?: string;
  dayId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * Compute cosine similarity between two vectors
 * Returns a value between 0 and 1, where 1 means identical
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  // Avoid division by zero
  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

/**
 * Find most similar vectors to query vector
 * Returns array of indices and scores, sorted by descending similarity
 */
export function findSimilar(
  queryVector: Float32Array,
  vectors: Array<{ id: string; vector: Float32Array; metadata?: VectorMetadata | undefined }>,
  topK: number = 10
): Array<{ id: string; score: number; metadata?: VectorMetadata | undefined }> {
  // Compute similarity scores for all vectors
  const scores = vectors.map((item) => ({
    id: item.id,
    score: cosineSimilarity(queryVector, item.vector),
    metadata: item.metadata,
  }));

  // Sort by descending score and take top K
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Extract a relevant excerpt from message content
 * Takes first ~150 characters or first sentence, whichever is shorter
 */
function extractExcerpt(content: string, maxLength: number = 150): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to find first sentence
  const sentenceEnd = content.search(/[.!?]\s/);
  if (sentenceEnd !== -1 && sentenceEnd < maxLength) {
    return content.substring(0, sentenceEnd + 1);
  }

  // Otherwise, truncate at word boundary
  const truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Memory Service implementation
 */
class MemoryService implements IMemoryService {
  /**
   * Search journal messages and notes using semantic similarity
   */
  async search(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Ensure embedding service is initialized
    const status = embeddingService.getStatus();
    if (!status.isReady) {
      console.log('[MemoryService] Initializing embedding service...');
      await embeddingService.initialize();
    }

    // Generate embedding for search query
    const queryEmbedding = await embeddingService.generateEmbedding(query.query);

    // Fetch all embeddings from database
    const allEmbeddings = await db.embeddings.find().exec();

    // Convert to searchable format with entity type info
    const vectors = allEmbeddings.map((doc) => ({
      id: doc.entityId,
      vector: new Float32Array(doc.vector),
      metadata: {
        embeddingId: doc.id,
        entityType: doc.entityType,
        entityId: doc.entityId,
        createdAt: doc.createdAt,
        modelVersion: doc.modelVersion,
      },
    }));

    // Find similar vectors
    const limit = query.limit || 10;
    const minScore = query.minScore || 0.0;

    const similarVectors = findSimilar(queryEmbedding.vector, vectors, limit * 2); // Get more to filter

    // Filter by minimum score
    const filtered = similarVectors.filter((result) => result.score >= minScore);

    // Separate message and note IDs
    const messageIds: string[] = [];
    const noteIds: string[] = [];

    for (const result of filtered) {
      const entityType = result.metadata?.entityType as string | undefined;
      if (entityType === 'note') {
        noteIds.push(result.id);
      } else {
        // Default to message for backward compatibility
        messageIds.push(result.id);
      }
    }

    // Fetch corresponding messages and notes
    const [messages, notes] = await Promise.all([
      messageIds.length > 0
        ? db.messages.find({ selector: { id: { $in: messageIds } } }).exec()
        : Promise.resolve([]),
      noteIds.length > 0
        ? db.notes.find({ selector: { id: { $in: noteIds } } }).exec()
        : Promise.resolve([]),
    ]);

    // Create maps for quick lookup
    const messageMap = new Map(messages.map((msg) => [msg.id, msg]));
    const noteMap = new Map(notes.map((note) => [note.id, note]));

    // Build search results with proper ranking
    const results: MemorySearchResult[] = [];
    let rank = 1;

    for (const similar of filtered.slice(0, limit)) {
      const entityType = similar.metadata?.entityType as string | undefined;

      if (entityType === 'note') {
        const note = noteMap.get(similar.id);
        if (!note) continue;

        // Apply day filter
        if (query.dayId && note.dayId !== query.dayId) {
          continue;
        }

        // Apply date range filter using dayId
        if (query.dateRange) {
          if (query.dateRange.startDate && note.dayId < query.dateRange.startDate) {
            continue;
          }
          if (query.dateRange.endDate && note.dayId > query.dateRange.endDate) {
            continue;
          }
        }

        const noteResult: NoteSearchResult = {
          entityType: 'note',
          entityId: note.id,
          note: note.toJSON() as Note,
          score: similar.score,
          excerpt: extractExcerpt(note.content),
          dayId: note.dayId,
          rank: rank++,
        };
        results.push(noteResult);
      } else {
        // Default to message
        const message = messageMap.get(similar.id);
        if (!message) continue;

        // Apply date range filter using dayId
        if (query.dateRange) {
          if (query.dateRange.startDate && message.dayId < query.dateRange.startDate) {
            continue;
          }
          if (query.dateRange.endDate && message.dayId > query.dateRange.endDate) {
            continue;
          }
        }

        if (query.dayId && message.dayId !== query.dayId) {
          continue;
        }

        const messageResult: MessageSearchResult = {
          entityType: 'message',
          entityId: message.id,
          message: message.toJSON() as Message,
          score: similar.score,
          excerpt: extractExcerpt(message.content),
          dayId: message.dayId,
          rank: rank++,
        };
        results.push(messageResult);
      }
    }

    return results;
  }

  /**
   * Index a new message for search
   * Queues the message for embedding generation
   */
  async indexMessage(message: Message): Promise<void> {
    // Queue the message for embedding generation
    memoryIndexer.queueForEmbedding(message.id);

    // Process the queue to generate embeddings
    // Note: This happens asynchronously, but we don't await it
    // to avoid blocking the message creation flow
    memoryIndexer.processQueue().catch((error) => {
      console.error('[MemoryService] Failed to process embedding queue:', error);
    });
  }

  /**
   * Re-index an existing message
   * Removes old embedding and creates a new one
   */
  async reindexMessage(messageId: string): Promise<void> {
    await memoryIndexer.reindexMessage(messageId);
  }

  /**
   * Remove a message from the index
   */
  async removeFromIndex(messageId: string): Promise<void> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Find and remove the embedding
    const embeddings = await db.embeddings
      .find({
        selector: { entityType: 'message', entityId: messageId },
      })
      .exec();

    for (const embedding of embeddings) {
      await embedding.remove();
    }
  }

  /**
   * Index a new note for search
   * Queues the note for embedding generation
   */
  async indexNote(note: Note): Promise<void> {
    // Queue the note for embedding generation
    memoryIndexer.queueEntityForEmbedding('note', note.id);

    // Process the queue to generate embeddings
    memoryIndexer.processQueue().catch((error) => {
      console.error('[MemoryService] Failed to process embedding queue:', error);
    });
  }

  /**
   * Re-index an existing note
   * Removes old embedding and creates a new one
   */
  async reindexNote(noteId: string): Promise<void> {
    await memoryIndexer.reindexNote(noteId);
  }

  /**
   * Remove a note from the index
   */
  async removeNoteFromIndex(noteId: string): Promise<void> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Find and remove the embedding
    const embeddings = await db.embeddings
      .find({
        selector: { entityType: 'note', entityId: noteId },
      })
      .exec();

    for (const embedding of embeddings) {
      await embedding.remove();
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<MemoryIndexStats> {
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

    // Find entities without embeddings
    const embeddedMessageIds = new Set(messageEmbeddings.map((e) => e.entityId));
    const embeddedNoteIds = new Set(noteEmbeddings.map((e) => e.entityId));
    const pendingMessages = allMessages.filter((m) => !embeddedMessageIds.has(m.id));
    const pendingNotes = allNotes.filter((n) => !embeddedNoteIds.has(n.id));

    // Get latest embedding timestamp
    let lastUpdated = 0;
    if (allEmbeddings.length > 0) {
      lastUpdated = Math.max(...allEmbeddings.map((e) => e.createdAt));
    }

    // Get model version from most recent embedding
    let modelVersion = 'unknown';
    if (allEmbeddings.length > 0) {
      const latest = allEmbeddings.sort((a, b) => b.createdAt - a.createdAt)[0];
      modelVersion = latest?.modelVersion || 'unknown';
    }

    return {
      totalMessages: allMessages.length,
      indexedMessages: messageEmbeddings.length,
      pendingMessages: pendingMessages.length,
      totalNotes: allNotes.length,
      indexedNotes: noteEmbeddings.length,
      pendingNotes: pendingNotes.length,
      lastUpdated,
      modelVersion,
    };
  }

  /**
   * Rebuild entire index
   * Re-generates embeddings for all messages using batch processing
   */
  async rebuildIndex(onProgress?: (current: number, total: number) => void): Promise<void> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Ensure embedding service is initialized
    const status = embeddingService.getStatus();
    if (!status.isReady) {
      console.log('[MemoryService] Initializing embedding service...');
      await embeddingService.initialize();
    }

    // Get all messages and notes
    const allMessages = await db.messages.find().exec();
    const allNotes = await db.notes.find().exec();
    const total = allMessages.length + allNotes.length;

    console.log(`[MemoryService] Rebuilding index for ${allMessages.length} messages and ${allNotes.length} notes...`);

    // Clear existing embeddings
    const allEmbeddings = await db.embeddings.find().exec();
    for (const embedding of allEmbeddings) {
      await embedding.remove();
    }

    if (total === 0) {
      console.log('[MemoryService] No messages or notes to index');
      return;
    }

    // Index messages using batch processing
    if (allMessages.length > 0) {
      const messageIds = allMessages.map((m) => m.id);
      const batchSize = 10;
      await memoryIndexer.processBatch(messageIds, batchSize);
    }

    // Report progress for messages
    if (onProgress) {
      onProgress(allMessages.length, total);
    }

    // Index notes one by one (they use indexEntityImmediate which handles content construction)
    if (allNotes.length > 0) {
      console.log(`[MemoryService] Indexing ${allNotes.length} notes...`);
      for (let i = 0; i < allNotes.length; i++) {
        const note = allNotes[i]!;
        try {
          await memoryIndexer.indexNoteImmediate(note.id);
        } catch (error) {
          console.error(`[MemoryService] Failed to index note ${note.id}:`, error);
        }
        if (onProgress) {
          onProgress(allMessages.length + i + 1, total);
        }
      }
    }

    console.log(`[MemoryService] Index rebuild complete: ${allMessages.length} messages and ${allNotes.length} notes indexed`);
  }

  /**
   * Analyze recurring themes across all journal entries
   * Identifies patterns and topics that appear frequently
   */
  async analyzeRecurringThemes(options?: {
    minFrequency?: number;
    maxThemes?: number;
  }): Promise<{
    themes: RecurringTheme[];
    insights: PatternInsight[];
    summary: string[];
  }> {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Get all embeddings (only messages for now)
    const allEmbeddings = await db.embeddings.find({
      selector: { entityType: 'message' },
    }).exec();

    if (allEmbeddings.length === 0) {
      return {
        themes: [],
        insights: [],
        summary: [],
      };
    }

    // Create embedding ID to message ID map
    const embeddingIdToMessageId = new Map<string, string>();
    allEmbeddings.forEach((emb) => {
      embeddingIdToMessageId.set(emb.id, emb.entityId);
    });

    // Convert to plain objects for analysis
    const embeddings = allEmbeddings.map((doc) => ({
      id: doc.id,
      entityType: doc.entityType,
      entityId: doc.entityId,
      vector: doc.vector,
      modelVersion: doc.modelVersion,
      createdAt: doc.createdAt,
    }));

    // Identify recurring themes
    const themes = identifyRecurringThemes(
      embeddings,
      embeddingIdToMessageId,
      options?.minFrequency || 3,
      options?.maxThemes || 10
    );

    if (themes.length === 0) {
      return {
        themes: [],
        insights: [],
        summary: [],
      };
    }

    // Get all messages for insight generation
    const messageIds = Array.from(
      new Set(themes.flatMap((t) => t.messageIds))
    );

    const messages = await db.messages
      .find({
        selector: {
          id: { $in: messageIds },
        },
      })
      .exec();

    const messageDocs = messages.map((doc) => doc.toJSON() as Message);

    // Generate insights
    const insights = generateThemeInsights(themes, messageDocs);

    // Get summary
    const summary = getThemeSummary(themes, messageDocs, 5);

    console.log(`[MemoryService] Found ${themes.length} recurring themes`);

    return {
      themes,
      insights,
      summary,
    };
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
