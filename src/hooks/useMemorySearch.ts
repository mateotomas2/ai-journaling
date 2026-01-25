/**
 * Hook for searching journal memories using natural language queries
 * Provides search state management, loading indicators, and error handling
 */

import { useState, useCallback } from 'react';
import type { MemorySearchResult, MemorySearchQuery } from '../../specs/006-vector-memory/contracts/memory-service';
import { memoryService } from '../services/memory/search';

export interface MemorySearchState {
  /** Current search query */
  query: string;
  /** Search results */
  results: MemorySearchResult[];
  /** Whether search is in progress */
  isLoading: boolean;
  /** Search error if any */
  error: Error | null;
  /** Whether a search has been performed */
  hasSearched: boolean;
}

export interface UseMemorySearchReturn extends MemorySearchState {
  /** Execute a search with the given query */
  search: (query: string, options?: SearchOptions) => Promise<void>;
  /** Clear search results and reset state */
  clear: () => void;
  /** Update the query without searching */
  setQuery: (query: string) => void;
}

export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum similarity score (0-1) */
  minScore?: number;
  /** Filter by specific day ID */
  dayId?: string;
  /** Filter by date range */
  dateRange?: {
    start?: number;
    end?: number;
  };
}

/**
 * Hook for managing memory search state and operations
 */
export function useMemorySearch(): UseMemorySearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (searchQuery: string, options: SearchOptions = {}) => {
    // Validate query
    if (!searchQuery || searchQuery.trim().length === 0) {
      setError(new Error('Search query cannot be empty'));
      return;
    }

    setQuery(searchQuery);
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // Build query object conditionally to satisfy exactOptionalPropertyTypes
      const queryObject: MemorySearchQuery = {
        query: searchQuery,
        limit: options.limit || 10,
        minScore: options.minScore || 0.3,
      };

      if (options.dayId) {
        queryObject.dayId = options.dayId;
      }

      if (options.dateRange) {
        queryObject.dateRange = options.dateRange;
      }

      const searchResults = await memoryService.search(queryObject);

      setResults(searchResults);
    } catch (err) {
      console.error('[useMemorySearch] Search failed:', err);
      setError(err instanceof Error ? err : new Error('Search failed'));
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setHasSearched(false);
  }, []);

  return {
    query,
    results,
    isLoading,
    error,
    hasSearched,
    search,
    clear,
    setQuery,
  };
}
