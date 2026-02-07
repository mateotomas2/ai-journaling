/**
 * Hook for monitoring memory index status
 * Provides statistics about indexed messages and pending queue
 */

import { useState, useEffect, useCallback } from 'react';
import { memoryService } from '../services/memory/search';
import { memoryIndexer } from '../services/memory/indexer';
import type { MemoryIndexStats } from '../../specs/006-vector-memory/contracts/memory-service';

export interface MemoryIndexState extends MemoryIndexStats {
  /** Number of messages in the indexing queue */
  queueLength: number;
  /** Whether index stats are being loaded */
  isLoading: boolean;
  /** Error loading stats if any */
  error: Error | null;
}

export interface UseMemoryIndexReturn extends MemoryIndexState {
  /** Refresh index statistics */
  refresh: () => Promise<void>;
  /** Rebuild the entire index */
  rebuildIndex: (onProgress?: (current: number, total: number) => void) => Promise<void>;
}

/**
 * Hook for monitoring memory index status and statistics
 */
export function useMemoryIndex(options?: {
  /** Auto-refresh interval in milliseconds (0 = no auto-refresh) */
  refreshInterval?: number;
}): UseMemoryIndexReturn {
  const { refreshInterval = 0 } = options || {};

  const [stats, setStats] = useState<MemoryIndexStats>({
    totalMessages: 0,
    indexedMessages: 0,
    pendingMessages: 0,
    totalNotes: 0,
    indexedNotes: 0,
    pendingNotes: 0,
    lastUpdated: 0,
    modelVersion: 'unknown',
  });
  const [queueLength, setQueueLength] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const indexStats = await memoryService.getIndexStats();
      const currentQueueLength = memoryIndexer.getQueueLength();

      setStats(indexStats);
      setQueueLength(currentQueueLength);
    } catch (err) {
      console.error('[useMemoryIndex] Failed to fetch index stats:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rebuildIndex = useCallback(
    async (onProgress?: (current: number, total: number) => void) => {
      setIsLoading(true);
      setError(null);

      try {
        await memoryService.rebuildIndex(onProgress);
        await refresh(); // Refresh stats after rebuild
      } catch (err) {
        console.error('[useMemoryIndex] Failed to rebuild index:', err);
        setError(err instanceof Error ? err : new Error('Failed to rebuild index'));
      } finally {
        setIsLoading(false);
      }
    },
    [refresh]
  );

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh on interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, refresh]);

  return {
    ...stats,
    queueLength,
    isLoading,
    error,
    refresh,
    rebuildIndex,
  };
}
