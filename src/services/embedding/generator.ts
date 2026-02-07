/**
 * Embedding Service
 * Manages embedding generation using Web Worker for off-thread processing
 */

import type {
  IEmbeddingService,
  EmbeddingResult,
  EmbeddingServiceStatus,
  EmbeddingWorkerMessage,
} from '../../../specs/006-vector-memory/contracts/embedding-service';

class EmbeddingService implements IEmbeddingService {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private isLoading: boolean = false;
  private modelVersion: string = '';
  private device: 'webgpu' | 'wasm' = 'wasm';
  private pendingRequests: Map<
    string,
    { resolve: (value: EmbeddingResult) => void; reject: (error: Error) => void }
  > = new Map();
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the embedding service and load the model
   */
  async initialize(): Promise<void> {
    if (this.isReady) {
      console.log('[EmbeddingService] Already initialized');
      return;
    }

    // If initialization is in progress, return the existing promise
    // This avoids polling and multiple concurrent initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.isLoading = true;
    this.initPromise = this.doInitialize();

    try {
      await this.initPromise;
    } finally {
      // Clear the promise after completion (success or failure)
      // This allows retry on failure
      if (!this.isReady) {
        this.initPromise = null;
      }
    }
  }

  /**
   * Internal initialization logic
   */
  private async doInitialize(): Promise<void> {

    try {
      console.log('[EmbeddingService] Creating Web Worker...');

      // Create Web Worker
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });

      console.log('[EmbeddingService] Worker created successfully');

      // Set up message handler
      this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));

      // Set up error handler
      this.worker.addEventListener('error', (error) => {
        console.error('[EmbeddingService] Worker error:', error);
        this.isLoading = false;
        this.isReady = false;
      });

      // Initialize model in worker
      console.log('[EmbeddingService] Sending init message to worker...');
      console.log('[EmbeddingService] This may take 10-60 seconds on first load while downloading the model (~90MB)...');

      return new Promise((resolve, reject) => {
        // Increase timeout to 2 minutes for model download
        const timeout = setTimeout(() => {
          this.isLoading = false;
          reject(new Error('Model initialization timed out after 120s. Please check your network connection and ensure you can access HuggingFace CDN.'));
        }, 120000);

        const initHandler = (event: MessageEvent<EmbeddingWorkerMessage>) => {
          if (event.data.type === 'init-complete') {
            clearTimeout(timeout);
            this.isReady = true;
            this.isLoading = false;
            this.modelVersion = event.data.modelVersion || 'unknown';

            console.log(
              `[EmbeddingService] Initialized in ${event.data.processingTimeMs?.toFixed(0)}ms`
            );
            console.log(`[EmbeddingService] Model version: ${this.modelVersion}`);

            resolve();
          } else if (event.data.type === 'error') {
            clearTimeout(timeout);
            this.isLoading = false;
            reject(new Error(event.data.error || 'Initialization failed'));
          }
        };

        this.worker?.addEventListener('message', initHandler, { once: true });

        // Send init message to worker
        const initMessage: EmbeddingWorkerMessage = { type: 'init' };
        this.worker?.postMessage(initMessage);
      });
    } catch (error) {
      this.isLoading = false;
      this.isReady = false;
      throw error;
    }
  }

  /**
   * Generate an embedding for the given text
   * Note: Long texts (>256 tokens) are automatically truncated by the model.
   * This is acceptable for semantic similarity as the first 256 tokens usually
   * capture the main content.
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.isReady || !this.worker) {
      throw new Error('Embedding service not initialized. Call initialize() first.');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty text');
    }

    // Log warning for very long texts
    if (text.length > 1500) { // ~256 tokens ≈ 1000-1500 characters
      console.warn(
        `[EmbeddingService] Text length (${text.length} chars) may exceed model limit. Will be truncated to first 256 tokens.`
      );
    }

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Store promise handlers for this request
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout for request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Embedding generation timed out after 10s'));
      }, 10000);

      // Create completion handler
      const handler = (result: EmbeddingResult) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        resolve(result);
      };

      // Update stored handler
      this.pendingRequests.set(id, {
        resolve: handler,
        reject: (error: Error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(error);
        },
      });

      // Send message to worker
      const message: EmbeddingWorkerMessage = {
        type: 'embed',
        id,
        text,
      };

      this.worker?.postMessage(message);
    });
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.isReady || !this.worker) {
      throw new Error('Embedding service not initialized. Call initialize() first.');
    }

    if (!texts || texts.length === 0) {
      throw new Error('Cannot generate embeddings for empty array');
    }

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Set timeout for batch request (longer timeout for batches)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Batch embedding generation timed out after ${texts.length * 2}s`));
      }, texts.length * 2000);

      // Store promise handlers
      this.pendingRequests.set(id, {
        resolve: (result: EmbeddingResult) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          // This will be called with a special batch result
          resolve([result]); // Wrapped in array for consistency
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(error);
        },
      });

      // Send batch message to worker
      const message: EmbeddingWorkerMessage = {
        type: 'batch-embed',
        id,
        texts,
      };

      this.worker?.postMessage(message);
    });
  }

  /**
   * Get current service status
   */
  getStatus(): EmbeddingServiceStatus {
    return {
      isReady: this.isReady,
      model: 'Xenova/all-MiniLM-L6-v2',
      version: this.modelVersion,
      device: this.device,
      isLoading: this.isLoading,
    };
  }

  /**
   * Cleanup and release resources
   */
  async dispose(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.isReady = false;
    this.isLoading = false;
    this.pendingRequests.clear();

    console.log('[EmbeddingService] Disposed');
  }

  /**
   * Handle messages from Web Worker
   */
  private handleWorkerMessage(event: MessageEvent<EmbeddingWorkerMessage>): void {
    const { type, id, embedding, embeddings, error, modelVersion, processingTimeMs } = event.data;

    if (type === 'embed-complete' && id) {
      const pending = this.pendingRequests.get(id);
      if (pending && embedding) {
        const result: EmbeddingResult = {
          vector: new Float32Array(embedding),
          modelVersion: modelVersion || this.modelVersion,
          timestamp: Date.now(),
          processingTimeMs: processingTimeMs || 0,
        };

        pending.resolve(result);
      }
    } else if (type === 'batch-embed-complete' && id) {
      const pending = this.pendingRequests.get(id);
      if (pending && embeddings) {
        // Convert batch results to individual EmbeddingResults
        const results: EmbeddingResult[] = embeddings.map((emb) => ({
          vector: new Float32Array(emb),
          modelVersion: modelVersion || this.modelVersion,
          timestamp: Date.now(),
          processingTimeMs: processingTimeMs || 0,
        }));

        // Resolve with array of results (cast through any to bypass type check)
        (pending.resolve as any)(results);
      }
    } else if (type === 'error' && id) {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        pending.reject(new Error(error || 'Unknown error'));
      }
    }
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
