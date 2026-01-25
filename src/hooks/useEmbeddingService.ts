/**
 * Hook for monitoring embedding service initialization status
 * Provides loading states and error handling for the embedding service
 */

import { useState, useEffect } from 'react';
import { embeddingService } from '../services/embedding/generator';

export interface EmbeddingServiceHookStatus {
  /** Whether the service is currently initializing */
  isInitializing: boolean;
  /** Whether the service is ready to use */
  isReady: boolean;
  /** Initialization error if any */
  error: Error | null;
  /** Model name once initialized */
  model?: string;
  /** Model version once initialized */
  version?: string;
}

/**
 * Hook for monitoring embedding service status
 * Automatically initializes the service on mount
 */
export function useEmbeddingService(options?: {
  /** Whether to auto-initialize on mount (default: true) */
  autoInitialize?: boolean;
}): EmbeddingServiceHookStatus & {
  /** Manually initialize the service */
  initialize: () => Promise<void>;
} {
  const { autoInitialize = true } = options || {};

  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [version, setVersion] = useState<string | undefined>(undefined);

  const initialize = async () => {
    if (isReady || isInitializing) {
      return; // Already initialized or in progress
    }

    setIsInitializing(true);
    setError(null);

    try {
      await embeddingService.initialize();

      const status = embeddingService.getStatus();
      setIsReady(status.isReady);
      setModel(status.model);
      setVersion(status.version);

      console.log('[useEmbeddingService] Service initialized successfully');
    } catch (err) {
      console.error('[useEmbeddingService] Failed to initialize service:', err);
      setError(err instanceof Error ? err : new Error('Initialization failed'));
      setIsReady(false);
    } finally {
      setIsInitializing(false);
    }
  };

  // Auto-initialize on mount if enabled
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInitialize]); // initialize is stable, don't need it in deps

  // Build return object conditionally for exactOptionalPropertyTypes
  const result: EmbeddingServiceHookStatus & { initialize: () => Promise<void> } = {
    isInitializing,
    isReady,
    error,
    initialize,
  };

  if (model !== undefined) {
    result.model = model;
  }

  if (version !== undefined) {
    result.version = version;
  }

  return result;
}
