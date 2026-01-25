/**
 * Unit tests for embedding generation service
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { embeddingService } from '../../src/services/embedding/generator';
import { EMBEDDING_MODEL_CONFIG, isNormalizedVector } from '../../src/services/embedding/models';

describe('Embedding Generation Service', () => {
  beforeAll(async () => {
    // Initialize embedding service before tests
    // This will load the model (may take a few seconds)
    await embeddingService.initialize();
  }, 60000); // 60s timeout for model loading

  afterAll(async () => {
    // Clean up resources
    await embeddingService.dispose();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', () => {
      const status = embeddingService.getStatus();

      expect(status.isReady).toBe(true);
      expect(status.isLoading).toBe(false);
      expect(status.model).toBe('Xenova/all-MiniLM-L6-v2');
      expect(status.version).toBeTruthy();
    });

    test('should not error on re-initialization', async () => {
      // Calling initialize again should be safe
      await expect(embeddingService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Embedding Generation', () => {
    test('should generate 384-dimension normalized vectors', async () => {
      const text = 'This is a test message for embedding generation';

      const result = await embeddingService.generateEmbedding(text);

      // Check vector dimensions
      expect(result.vector).toHaveLength(EMBEDDING_MODEL_CONFIG.dimensions);
      expect(result.vector).toBeInstanceOf(Float32Array);

      // Check normalization (sum of squares ≈ 1.0)
      expect(isNormalizedVector(result.vector)).toBe(true);

      // Check metadata
      expect(result.modelVersion).toBe(EMBEDDING_MODEL_CONFIG.modelVersion);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    test('should generate different embeddings for different text', async () => {
      const text1 = 'I feel happy and energized today';
      const text2 = 'The weather is cold and rainy';

      const result1 = await embeddingService.generateEmbedding(text1);
      const result2 = await embeddingService.generateEmbedding(text2);

      // Vectors should be different
      expect(result1.vector).not.toEqual(result2.vector);

      // But both should be normalized
      expect(isNormalizedVector(result1.vector)).toBe(true);
      expect(isNormalizedVector(result2.vector)).toBe(true);
    });

    test('should generate similar embeddings for similar text', async () => {
      const text1 = 'I am feeling anxious about work';
      const text2 = 'Work is making me feel stressed';

      const result1 = await embeddingService.generateEmbedding(text1);
      const result2 = await embeddingService.generateEmbedding(text2);

      // Compute cosine similarity (dot product since vectors are normalized)
      let similarity = 0;
      for (let i = 0; i < result1.vector.length; i++) {
        similarity += result1.vector[i]! * result2.vector[i]!;
      }

      // Similar text should have similarity > 0.5
      expect(similarity).toBeGreaterThan(0.5);
    });

    test('should handle long text by truncation', async () => {
      // Generate text longer than 256 tokens (~200 words)
      const longText = 'word '.repeat(300); // 300 words

      const result = await embeddingService.generateEmbedding(longText);

      // Should still generate valid embedding
      expect(result.vector).toHaveLength(EMBEDDING_MODEL_CONFIG.dimensions);
      expect(isNormalizedVector(result.vector)).toBe(true);
    });

    test('should reject empty text', async () => {
      await expect(embeddingService.generateEmbedding('')).rejects.toThrow(
        'Cannot generate embedding for empty text'
      );
    });

    test('should reject whitespace-only text', async () => {
      await expect(embeddingService.generateEmbedding('   ')).rejects.toThrow(
        'Cannot generate embedding for empty text'
      );
    });

    test('should complete in reasonable time', async () => {
      const text = 'Performance test message';

      const startTime = performance.now();
      await embeddingService.generateEmbedding(text);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in under 1 second (WebGPU: 20-50ms, WASM: 50-150ms + overhead)
      expect(duration).toBeLessThan(1000);
    }, 5000);
  });

  describe('Batch Embedding Generation', () => {
    test('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First message about work',
        'Second message about family',
        'Third message about health',
      ];

      const results = await embeddingService.generateBatchEmbeddings(texts);

      expect(results).toHaveLength(texts.length);

      // Each result should be valid
      results.forEach((result) => {
        expect(result.vector).toHaveLength(EMBEDDING_MODEL_CONFIG.dimensions);
        expect(isNormalizedVector(result.vector)).toBe(true);
        expect(result.modelVersion).toBe(EMBEDDING_MODEL_CONFIG.modelVersion);
      });
    });

    test('should reject empty array', async () => {
      await expect(embeddingService.generateBatchEmbeddings([])).rejects.toThrow(
        'Cannot generate embeddings for empty array'
      );
    });
  });

  describe('Vector Properties', () => {
    test('all vector values should be between -1 and 1', async () => {
      const text = 'Test message for vector value bounds';

      const result = await embeddingService.generateEmbedding(text);

      // Check all values are in valid range
      for (let i = 0; i < result.vector.length; i++) {
        const value = result.vector[i]!;
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    test('vector should have non-zero magnitude', async () => {
      const text = 'Test message for vector magnitude';

      const result = await embeddingService.generateEmbedding(text);

      // Calculate magnitude (should be ~1.0 for normalized vector)
      let magnitude = 0;
      for (let i = 0; i < result.vector.length; i++) {
        magnitude += result.vector[i]! * result.vector[i]!;
      }
      magnitude = Math.sqrt(magnitude);

      expect(magnitude).toBeGreaterThan(0.99);
      expect(magnitude).toBeLessThan(1.01);
    });
  });
});
