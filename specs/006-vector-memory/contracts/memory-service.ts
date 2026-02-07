/**
 * Memory Service Contract
 *
 * Defines the interface for semantic search and memory retrieval operations.
 */

import type { Message, Note } from '../../../src/types/entities';

export interface MemorySearchQuery {
  /** The search query text (will be embedded for similarity search) */
  query: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum similarity score (0-1) to include in results */
  minScore?: number;
  /** Optional date range filter */
  dateRange?: {
    start?: number; // Unix timestamp
    end?: number; // Unix timestamp
  };
  /** Optional day ID filter (search within specific day) */
  dayId?: string;
}

/** Base interface for search results */
interface BaseSearchResult {
  /** Similarity score (0-1, higher is more similar) */
  score: number;
  /** Relevant excerpt from the content (for preview) */
  excerpt: string;
  /** Ranking position in results (1-based) */
  rank: number;
  /** Day ID for navigation */
  dayId: string;
}

/** Search result for a message */
export interface MessageSearchResult extends BaseSearchResult {
  entityType: 'message';
  entityId: string;
  message: Message;
}

/** Search result for a note */
export interface NoteSearchResult extends BaseSearchResult {
  entityType: 'note';
  entityId: string;
  note: Note;
}

/** Discriminated union of all search result types */
export type MemorySearchResult = MessageSearchResult | NoteSearchResult;

/** Type guard for message search results */
export function isMessageResult(result: MemorySearchResult): result is MessageSearchResult {
  return result.entityType === 'message';
}

/** Type guard for note search results */
export function isNoteResult(result: MemorySearchResult): result is NoteSearchResult {
  return result.entityType === 'note';
}

/** @deprecated Use MemorySearchResult instead */
export interface LegacyMemorySearchResult {
  /** The matching message */
  message: Message;
  /** Similarity score (0-1, higher is more similar) */
  score: number;
  /** Relevant excerpt from the message (for preview) */
  excerpt: string;
  /** Ranking position in results (1-based) */
  rank: number;
}

export interface MemoryIndexStats {
  /** Total number of indexed messages */
  totalMessages: number;
  /** Number of messages with embeddings */
  indexedMessages: number;
  /** Number of messages pending embedding */
  pendingMessages: number;
  /** Total number of notes */
  totalNotes: number;
  /** Number of notes with embeddings */
  indexedNotes: number;
  /** Number of notes pending embedding */
  pendingNotes: number;
  /** Timestamp of last index update */
  lastUpdated: number;
  /** Model version being used */
  modelVersion: string;
}

/**
 * Service for semantic search and memory retrieval operations
 */
export interface IMemoryService {
  /**
   * Search journal messages and notes using semantic similarity
   * @param query Search query parameters
   * @returns Array of matching results with scores
   */
  search(query: MemorySearchQuery): Promise<MemorySearchResult[]>;

  /**
   * Index a new message for search
   * Generates and stores embedding asynchronously
   * @param message The message to index
   * @returns Promise that resolves when indexing is complete
   */
  indexMessage(message: Message): Promise<void>;

  /**
   * Re-index an existing message (after content update)
   * @param messageId ID of message to re-index
   * @returns Promise that resolves when re-indexing is complete
   */
  reindexMessage(messageId: string): Promise<void>;

  /**
   * Remove a message from the index
   * @param messageId ID of message to remove
   */
  removeFromIndex(messageId: string): Promise<void>;

  /**
   * Index a new note for search
   * Generates and stores embedding asynchronously
   * @param note The note to index
   * @returns Promise that resolves when indexing is complete
   */
  indexNote(note: Note): Promise<void>;

  /**
   * Re-index an existing note (after content update)
   * @param noteId ID of note to re-index
   * @returns Promise that resolves when re-indexing is complete
   */
  reindexNote(noteId: string): Promise<void>;

  /**
   * Remove a note from the index
   * @param noteId ID of note to remove
   */
  removeNoteFromIndex(noteId: string): Promise<void>;

  /**
   * Get index statistics
   * @returns Current index stats
   */
  getIndexStats(): Promise<MemoryIndexStats>;

  /**
   * Rebuild entire index (for all messages)
   * Should be used sparingly (e.g., after model upgrade)
   * @param onProgress Optional callback for progress updates
   */
  rebuildIndex(onProgress?: (current: number, total: number) => void): Promise<void>;
}

/**
 * Similarity search algorithm interface
 * Abstraction allows swapping between flat/brute-force and ANN approaches
 */
export interface ISimilaritySearch {
  /**
   * Find most similar vectors to query vector
   * @param queryVector The query embedding
   * @param vectors Array of vectors to search
   * @param topK Number of results to return
   * @returns Indices and scores of top-K most similar vectors
   */
  findSimilar(
    queryVector: Float32Array,
    vectors: Float32Array[],
    topK: number
  ): Array<{ index: number; score: number }>;

  /**
   * Compute similarity between two vectors
   * @param a First vector
   * @param b Second vector
   * @returns Similarity score (0-1, cosine similarity)
   */
  computeSimilarity(a: Float32Array, b: Float32Array): number;
}

/**
 * Memory indexer interface for managing embedding lifecycle
 */
export interface IMemoryIndexer {
  /**
   * Queue a message for embedding generation
   * @param messageId Message to queue
   */
  queueForEmbedding(messageId: string): void;

  /**
   * Get count of messages in embedding queue
   */
  getQueueLength(): number;

  /**
   * Process the embedding queue
   * Generates embeddings for all queued messages
   */
  processQueue(): Promise<void>;

  /**
   * Check if a message has a valid embedding
   * @param messageId Message ID to check
   * @returns True if message has embedding
   */
  hasEmbedding(messageId: string): Promise<boolean>;

  /**
   * Clean up orphaned embeddings
   * Removes embeddings for deleted messages
   * @returns Number of embeddings removed
   */
  cleanupOrphans(): Promise<number>;
}
