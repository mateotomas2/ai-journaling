/**
 * React Hooks Contracts
 *
 * Defines the interface for React hooks used in UI components
 */

import type { MemorySearchQuery, MemorySearchResult, MemoryIndexStats } from './memory-service';

/**
 * Hook state for memory search
 */
export interface UseMemorySearchReturn {
  /** Current search results */
  results: MemorySearchResult[];
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Execute a search */
  search: (query: MemorySearchQuery) => Promise<void>;
  /** Clear current results */
  clear: () => void;
  /** Whether the memory service is initialized and ready */
  isReady: boolean;
}

/**
 * Hook for manual memory search (used in search UI)
 */
export interface IUseMemorySearch {
  (): UseMemorySearchReturn;
}

/**
 * Hook state for memory indexing status
 */
export interface UseMemoryIndexReturn {
  /** Index statistics */
  stats: MemoryIndexStats | null;
  /** Whether indexing is in progress */
  isIndexing: boolean;
  /** Error message if indexing failed */
  error: string | null;
  /** Manually trigger index rebuild */
  rebuildIndex: () => Promise<void>;
  /** Index rebuild progress (0-100) */
  rebuildProgress: number;
  /** Refresh index stats */
  refresh: () => Promise<void>;
}

/**
 * Hook for monitoring and managing memory index
 * Used in settings/debug UI
 */
export interface IUseMemoryIndex {
  (): UseMemoryIndexReturn;
}

/**
 * Hook state for embedding generation status
 */
export interface UseEmbeddingServiceReturn {
  /** Whether service is initialized */
  isReady: boolean;
  /** Whether service is initializing */
  isInitializing: boolean;
  /** Current device being used */
  device: 'webgpu' | 'wasm' | null;
  /** Model version */
  modelVersion: string | null;
  /** Error during initialization */
  error: string | null;
  /** Manually initialize service */
  initialize: () => Promise<void>;
}

/**
 * Hook for embedding service status
 * Handles service initialization and monitoring
 */
export interface IUseEmbeddingService {
  (): UseEmbeddingServiceReturn;
}
