/**
 * Memory Service Contract
 *
 * Defines the interface for semantic search and memory retrieval operations.
 */

import type { Message } from '../../../src/types/entities';

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

export interface MemorySearchResult {
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
   * Search journal messages using semantic similarity
   * @param query Search query parameters
   * @returns Array of matching messages with scores
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
