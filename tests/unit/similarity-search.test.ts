/**
 * Unit tests for similarity search utilities
 */

import { describe, test, expect } from 'vitest';
import { cosineSimilarity, findSimilar } from '../../src/services/memory/search';

describe('Similarity Search Utilities', () => {
  describe('Cosine Similarity', () => {
    test('should return 1.0 for identical vectors', () => {
      const v1 = new Float32Array([1, 0, 0, 0]);
      const v2 = new Float32Array([1, 0, 0, 0]);

      const similarity = cosineSimilarity(v1, v2);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    test('should return 0.0 for orthogonal vectors', () => {
      const v1 = new Float32Array([1, 0, 0, 0]);
      const v2 = new Float32Array([0, 1, 0, 0]);

      const similarity = cosineSimilarity(v1, v2);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    test('should return -1.0 for opposite vectors', () => {
      const v1 = new Float32Array([1, 0, 0, 0]);
      const v2 = new Float32Array([-1, 0, 0, 0]);

      const similarity = cosineSimilarity(v1, v2);

      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    test('should handle normalized vectors correctly', () => {
      // Normalized vectors
      const v1 = new Float32Array([0.6, 0.8, 0, 0]); // magnitude = 1.0
      const v2 = new Float32Array([0.8, 0.6, 0, 0]); // magnitude = 1.0

      const similarity = cosineSimilarity(v1, v2);

      // cos(θ) where θ is angle between vectors
      // Expected: 0.6*0.8 + 0.8*0.6 = 0.96
      expect(similarity).toBeCloseTo(0.96, 5);
    });

    test('should handle non-normalized vectors', () => {
      const v1 = new Float32Array([3, 4, 0]); // magnitude = 5
      const v2 = new Float32Array([4, 3, 0]); // magnitude = 5

      const similarity = cosineSimilarity(v1, v2);

      // cos(θ) = (3*4 + 4*3) / (5*5) = 24/25 = 0.96
      expect(similarity).toBeCloseTo(0.96, 5);
    });

    test('should handle high-dimensional vectors', () => {
      const dim = 384; // Same as embedding dimensions

      // Create two similar vectors
      const v1 = new Float32Array(dim);
      const v2 = new Float32Array(dim);

      for (let i = 0; i < dim; i++) {
        v1[i] = Math.random();
        v2[i] = v1[i]! + (Math.random() - 0.5) * 0.1; // Slightly different
      }

      const similarity = cosineSimilarity(v1, v2);

      // Should be high similarity (>0.9) since vectors are similar
      expect(similarity).toBeGreaterThan(0.9);
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    test('should return 0 for zero vectors', () => {
      const v1 = new Float32Array([0, 0, 0, 0]);
      const v2 = new Float32Array([1, 1, 1, 1]);

      const similarity = cosineSimilarity(v1, v2);

      expect(similarity).toBe(0);
    });

    test('should throw error for mismatched dimensions', () => {
      const v1 = new Float32Array([1, 0, 0]);
      const v2 = new Float32Array([1, 0]); // Different length

      expect(() => cosineSimilarity(v1, v2)).toThrow('Vector dimension mismatch');
    });

    test('should be commutative', () => {
      const v1 = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const v2 = new Float32Array([0.3, 0.7, 0.2, 0.8]);

      const sim1 = cosineSimilarity(v1, v2);
      const sim2 = cosineSimilarity(v2, v1);

      expect(sim1).toBeCloseTo(sim2, 10);
    });

    test('should handle negative values', () => {
      const v1 = new Float32Array([1, -1, 1, -1]);
      const v2 = new Float32Array([-1, 1, -1, 1]);

      const similarity = cosineSimilarity(v1, v2);

      // Opposite vectors should have -1.0 similarity
      expect(similarity).toBeCloseTo(-1.0, 5);
    });
  });

  describe('Find Similar', () => {
    test('should find top K most similar vectors', () => {
      const query = new Float32Array([1, 0, 0]);

      const vectors = [
        { id: 'v1', vector: new Float32Array([1, 0, 0]) }, // Perfect match
        { id: 'v2', vector: new Float32Array([0.9, 0.1, 0]) }, // High similarity
        { id: 'v3', vector: new Float32Array([0.5, 0.5, 0]) }, // Medium similarity
        { id: 'v4', vector: new Float32Array([0, 1, 0]) }, // Low similarity
        { id: 'v5', vector: new Float32Array([0, 0, 1]) }, // Low similarity
      ];

      const results = findSimilar(query, vectors, 3);

      expect(results).toHaveLength(3);
      expect(results[0]?.id).toBe('v1'); // Best match
      expect(results[0]?.score).toBeCloseTo(1.0, 5);
      expect(results[1]?.id).toBe('v2'); // Second best
      expect(results[2]?.id).toBe('v3'); // Third best
    });

    test('should sort results by descending score', () => {
      const query = new Float32Array([1, 1, 0, 0]);

      const vectors = [
        { id: 'low', vector: new Float32Array([0, 0, 1, 1]) },
        { id: 'high', vector: new Float32Array([1, 1, 0, 0]) },
        { id: 'medium', vector: new Float32Array([1, 0, 1, 0]) },
      ];

      const results = findSimilar(query, vectors, 3);

      // Should be sorted by score
      expect(results[0]?.id).toBe('high');
      expect(results[1]?.id).toBe('medium');
      expect(results[2]?.id).toBe('low');

      // Scores should be descending
      expect(results[0]?.score).toBeGreaterThan(results[1]!.score);
      expect(results[1]?.score).toBeGreaterThan(results[2]!.score);
    });

    test('should limit results to top K', () => {
      const query = new Float32Array([1, 0, 0, 0]);

      const vectors = Array.from({ length: 20 }, (_, i) => ({
        id: `v${i}`,
        vector: new Float32Array([Math.random(), Math.random(), Math.random(), Math.random()]),
      }));

      const topK = 5;
      const results = findSimilar(query, vectors, topK);

      expect(results).toHaveLength(topK);
    });

    test('should handle empty vector array', () => {
      const query = new Float32Array([1, 0, 0]);
      const vectors: Array<{ id: string; vector: Float32Array }> = [];

      const results = findSimilar(query, vectors, 5);

      expect(results).toHaveLength(0);
    });

    test('should handle K larger than array size', () => {
      const query = new Float32Array([1, 0, 0]);

      const vectors = [
        { id: 'v1', vector: new Float32Array([1, 0, 0]) },
        { id: 'v2', vector: new Float32Array([0, 1, 0]) },
      ];

      const results = findSimilar(query, vectors, 10);

      // Should return all available vectors
      expect(results).toHaveLength(2);
    });

    test('should preserve metadata in results', () => {
      const query = new Float32Array([1, 0, 0]);

      const vectors = [
        {
          id: 'msg1',
          vector: new Float32Array([1, 0, 0]),
          metadata: { timestamp: 123, dayId: 'day1' },
        },
        {
          id: 'msg2',
          vector: new Float32Array([0.9, 0.1, 0]),
          metadata: { timestamp: 456, dayId: 'day2' },
        },
      ];

      const results = findSimilar(query, vectors, 2);

      expect(results[0]?.metadata).toEqual({ timestamp: 123, dayId: 'day1' });
      expect(results[1]?.metadata).toEqual({ timestamp: 456, dayId: 'day2' });
    });

    test('should handle vectors with identical scores', () => {
      const query = new Float32Array([1, 0, 0, 0]);

      const vectors = [
        { id: 'v1', vector: new Float32Array([0, 1, 0, 0]) }, // Same distance
        { id: 'v2', vector: new Float32Array([0, 0, 1, 0]) }, // Same distance
        { id: 'v3', vector: new Float32Array([0, 0, 0, 1]) }, // Same distance
      ];

      const results = findSimilar(query, vectors, 3);

      // All should be returned (order may vary due to stable sort)
      expect(results).toHaveLength(3);
      expect(results.map((r) => r.id).sort()).toEqual(['v1', 'v2', 'v3']);
    });

    test('should work with 384-dimensional vectors', () => {
      const dim = 384;

      const query = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        query[i] = Math.random();
      }

      const vectors = Array.from({ length: 10 }, (_, i) => {
        const vec = new Float32Array(dim);
        for (let j = 0; j < dim; j++) {
          vec[j] = Math.random();
        }
        return { id: `v${i}`, vector: vec };
      });

      const results = findSimilar(query, vectors, 5);

      expect(results).toHaveLength(5);
      expect(results[0]?.score).toBeGreaterThanOrEqual(0);
      expect(results[0]?.score).toBeLessThanOrEqual(1);
    });
  });
});
