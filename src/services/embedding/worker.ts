/**
 * Web Worker for off-thread embedding generation
 * Uses @huggingface/transformers v3 with singleton pattern
 * Based on: https://huggingface.co/docs/transformers.js/tutorials/react
 */

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

/**
 * Progress callback type for model loading
 */
type ProgressInfo = {
  status: string;
  file?: string;
  progress?: number;
};

/**
 * Singleton pipeline manager for embedding model
 * Ensures model loads only once and is reused across requests
 */
class MyEmbeddingPipeline {
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: Promise<FeatureExtractionPipeline> | null = null;

  static async getInstance(progressCallback?: (progress: ProgressInfo) => void): Promise<FeatureExtractionPipeline> {
    if (!this.instance) {
      console.log('[Worker] Creating new pipeline instance...');
      this.instance = (async () => {
        const result = await pipeline('feature-extraction', this.model, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback: progressCallback,
        } as Record<string, unknown>);
        return result as FeatureExtractionPipeline;
      })();
    }
    return this.instance;
  }
}

const MODEL_VERSION = 'all-MiniLM-L6-v2@v0';

/**
 * Message types for worker communication
 */
type WorkerMessageType = 'init' | 'embed' | 'batch-embed';

interface WorkerMessage {
  type: WorkerMessageType;
  id?: string;
  text?: string;
  texts?: string[];
}

interface WorkerResponse {
  type: 'init-complete' | 'embed-complete' | 'batch-embed-complete' | 'error';
  id: string | undefined;
  embedding?: number[];
  embeddings?: number[][];
  error?: string;
  modelVersion?: string;
  processingTimeMs?: number;
}

/**
 * Initialize the embedding model
 */
async function initializeModel(): Promise<void> {
  console.log('[Worker] Initializing embedding model...');
  console.log('[Worker] Model:', MyEmbeddingPipeline.model);
  console.log('[Worker] First-time initialization will download ~90MB of model files...');

  const startTime = performance.now();

  try {
    console.log('[Worker] Downloading model from HuggingFace CDN...');

    // Set up progress callback
    const progressCallback = (progress: ProgressInfo) => {
      if (progress.status === 'progress' && progress.file) {
        const pct = typeof progress.progress === 'number' ? progress.progress.toFixed(0) : '?';
        console.log(`[Worker] Downloading ${progress.file}: ${pct}%`);
      } else if (progress.status === 'done' && progress.file) {
        console.log(`[Worker] Downloaded ${progress.file}`);
      }
    };

    // Load the model using singleton pattern
    await MyEmbeddingPipeline.getInstance(progressCallback);

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    console.log(`[Worker] Model loaded successfully in ${duration}s`);
  } catch (error) {
    console.error('[Worker] Failed to load model:', error);
    console.error('[Worker] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(
      `Failed to initialize embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embedding for a single text
 */
async function generateEmbedding(text: string): Promise<Float32Array> {
  const embedder = await MyEmbeddingPipeline.getInstance();

  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const startTime = performance.now();

  // Generate embedding with mean pooling and normalization
  const result = await embedder(text, {
    pooling: 'mean', // Average token embeddings
    normalize: true, // Normalize to unit length (for cosine similarity)
  });

  const endTime = performance.now();

  // Extract the embedding array from the result
  const embedding = result.data as Float32Array;

  console.log(
    `[Worker] Generated embedding in ${(endTime - startTime).toFixed(0)}ms (${embedding.length} dimensions)`
  );

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
async function generateBatchEmbeddings(texts: string[]): Promise<Float32Array[]> {
  if (!texts || texts.length === 0) {
    throw new Error('Cannot generate embeddings for empty array');
  }

  const startTime = performance.now();
  const embeddings: Float32Array[] = [];

  // Process each text individually
  // (Processing individually is more reliable in workers)
  for (const text of texts) {
    if (text && text.trim().length > 0) {
      const embedding = await generateEmbedding(text);
      embeddings.push(embedding);
    } else {
      console.warn('[Worker] Skipping empty text in batch');
    }
  }

  const endTime = performance.now();

  console.log(
    `[Worker] Generated ${embeddings.length} embeddings in ${(endTime - startTime).toFixed(0)}ms`
  );

  return embeddings;
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, text, texts } = event.data;

  try {
    if (type === 'init') {
      const startTime = performance.now();
      await initializeModel();
      const endTime = performance.now();

      const response: WorkerResponse = {
        type: 'init-complete',
        id: undefined,
        modelVersion: MODEL_VERSION,
        processingTimeMs: endTime - startTime,
      };

      self.postMessage(response);
    } else if (type === 'embed' && text) {
      const startTime = performance.now();
      const embedding = await generateEmbedding(text);
      const endTime = performance.now();

      const response: WorkerResponse = {
        type: 'embed-complete',
        id,
        embedding: Array.from(embedding), // Convert to regular array for postMessage
        modelVersion: MODEL_VERSION,
        processingTimeMs: endTime - startTime,
      };

      self.postMessage(response);
    } else if (type === 'batch-embed' && texts) {
      const startTime = performance.now();
      const embeddings = await generateBatchEmbeddings(texts);
      const endTime = performance.now();

      const response: WorkerResponse = {
        type: 'batch-embed-complete',
        id,
        embeddings: embeddings.map((emb) => Array.from(emb)), // Convert to arrays
        modelVersion: MODEL_VERSION,
        processingTimeMs: endTime - startTime,
      };

      self.postMessage(response);
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const response: WorkerResponse = {
      type: 'error',
      id,
      error: errorMessage,
    };

    self.postMessage(response);
    console.error('[Worker] Error:', error);
  }
});

console.log('[Worker] Embedding worker initialized and ready');
