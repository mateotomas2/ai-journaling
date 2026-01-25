/**
 * Embedding Service Contract
 *
 * Defines the interface for generating vector embeddings from text.
 * All operations are client-side (no external API calls).
 */

export interface EmbeddingServiceConfig {
  /** Model to use for embeddings */
  modelName: string;
  /** Model version identifier for tracking migrations */
  modelVersion: string;
  /** Device preference: 'webgpu' or 'wasm' */
  device: 'webgpu' | 'wasm';
  /** Data type for quantization */
  dtype?: 'fp32' | 'fp16' | 'q8';
}

export interface EmbeddingResult {
  /** The embedding vector (384 dimensions) */
  vector: Float32Array;
  /** Model version that generated this embedding */
  modelVersion: string;
  /** Generation timestamp */
  timestamp: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

export interface EmbeddingServiceStatus {
  /** Whether the service is initialized and ready */
  isReady: boolean;
  /** Current model being used */
  model: string;
  /** Model version */
  version: string;
  /** Device being used (webgpu or wasm) */
  device: 'webgpu' | 'wasm';
  /** Whether model is currently loading */
  isLoading: boolean;
}

/**
 * Service for generating text embeddings using local browser-based models
 */
export interface IEmbeddingService {
  /**
   * Initialize the embedding service and load the model
   * @returns Promise that resolves when service is ready
   */
  initialize(): Promise<void>;

  /**
   * Generate an embedding for the given text
   * @param text The text to embed (will be truncated to 256 tokens)
   * @returns Embedding result with vector and metadata
   * @throws Error if service not initialized or text is empty
   */
  generateEmbedding(text: string): Promise<EmbeddingResult>;

  /**
   * Generate embeddings for multiple texts in batch
   * @param texts Array of texts to embed
   * @returns Array of embedding results in same order as input
   */
  generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]>;

  /**
   * Get current service status
   * @returns Service status information
   */
  getStatus(): EmbeddingServiceStatus;

  /**
   * Cleanup and release resources
   */
  dispose(): Promise<void>;
}

/**
 * Web Worker message types for embedding generation
 */
export type EmbeddingWorkerMessageType =
  | 'init'
  | 'init-complete'
  | 'embed'
  | 'embed-complete'
  | 'batch-embed'
  | 'batch-embed-complete'
  | 'error';

export interface EmbeddingWorkerMessage {
  type: EmbeddingWorkerMessageType;
  id?: string;
  text?: string;
  texts?: string[];
  embedding?: number[];
  embeddings?: number[][];
  error?: string;
  modelVersion?: string;
  processingTimeMs?: number;
}
