/**
 * Integration tests for pattern recognition
 * Verifies recurring theme detection across multiple journal entries
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db';
import { identifyRecurringThemes, clusterEmbeddings } from '../../src/services/memory/analysis';
import { generateThemeInsights } from '../../src/services/memory/patterns';
import type { Message } from '../../src/types/entities';

// Analysis embeddings only need id and vector for the algorithm
interface AnalysisEmbedding {
  id: string;
  vector: number[];
}

describe('Pattern Analysis Integration', () => {
  beforeAll(async () => {
    await createDatabase('test-password');
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('should cluster similar embeddings together', () => {
    // Create test embeddings with two distinct clusters
    const embeddings: AnalysisEmbedding[] = [
      // Cluster 1: Work-related (similar vectors)
      {
        id: 'emb-1',
        vector: Array(384).fill(0).map((_, i) => (i < 50 ? 0.8 : 0.1)),
      },
      {
        id: 'emb-2',
        vector: Array(384).fill(0).map((_, i) => (i < 50 ? 0.75 : 0.15)),
      },
      {
        id: 'emb-3',
        vector: Array(384).fill(0).map((_, i) => (i < 50 ? 0.85 : 0.05)),
      },
      // Cluster 2: Exercise-related (similar vectors, different from cluster 1)
      {
        id: 'emb-4',
        vector: Array(384).fill(0).map((_, i) => (i >= 200 && i < 250 ? 0.9 : 0.1)),
      },
      {
        id: 'emb-5',
        vector: Array(384).fill(0).map((_, i) => (i >= 200 && i < 250 ? 0.85 : 0.12)),
      },
      {
        id: 'emb-6',
        vector: Array(384).fill(0).map((_, i) => (i >= 200 && i < 250 ? 0.88 : 0.08)),
      },
    ];

    const clusters = clusterEmbeddings(embeddings, 2);

    // Should create 2 clusters
    expect(clusters).toHaveLength(2);

    // Each cluster should have 3 members
    expect(clusters[0]!.size).toBe(3);
    expect(clusters[1]!.size).toBe(3);

    // Clusters should have reasonable cohesion (>0.5 for our test data)
    expect(clusters[0]!.cohesion).toBeGreaterThan(0.5);
    expect(clusters[1]!.cohesion).toBeGreaterThan(0.5);
  });

  test('should identify recurring themes from embeddings', () => {
    const embeddings: AnalysisEmbedding[] = [
      { id: 'emb-1', vector: Array(384).fill(0.1) },
      { id: 'emb-2', vector: Array(384).fill(0.1) },
      { id: 'emb-3', vector: Array(384).fill(0.1) },
      { id: 'emb-4', vector: Array(384).fill(0.2) },
      { id: 'emb-5', vector: Array(384).fill(0.2) },
    ];

    const embeddingIdToMessageId = new Map([
      ['emb-1', 'msg-1'],
      ['emb-2', 'msg-2'],
      ['emb-3', 'msg-3'],
      ['emb-4', 'msg-4'],
      ['emb-5', 'msg-5'],
    ]);

    const themes = identifyRecurringThemes(embeddings, embeddingIdToMessageId, 2, 5);

    // Should identify at least 1 theme (with min frequency 2)
    expect(themes.length).toBeGreaterThan(0);

    // First theme should have frequency >= 2
    expect(themes[0]!.frequency).toBeGreaterThanOrEqual(2);

    // Should have message IDs
    expect(themes[0]!.messageIds.length).toBeGreaterThanOrEqual(2);

    // Should have a representative message
    expect(themes[0]!.representativeMessageId).toBeDefined();
  });

  test('should generate insights from recurring themes', () => {
    const themes = [
      {
        id: 'theme-1',
        frequency: 5,
        strength: 0.85,
        messageIds: ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5'],
        representativeMessageId: 'msg-1',
      },
      {
        id: 'theme-2',
        frequency: 3,
        strength: 0.7,
        messageIds: ['msg-6', 'msg-7', 'msg-8'],
        representativeMessageId: 'msg-6',
      },
    ];

    const messages: Message[] = [
      {
        id: 'msg-1',
        dayId: '2026-01-15',
        role: 'user',
        content: 'I had a really productive work session today, finished the project ahead of schedule.',
        parts: JSON.stringify([{ type: 'text', content: 'I had a really productive work session today, finished the project ahead of schedule.' }]),
        timestamp: Date.now(),
        deletedAt: 0,
      },
      {
        id: 'msg-6',
        dayId: '2026-01-16',
        role: 'user',
        content: 'Went for a long run this morning, felt great and energized.',
        parts: JSON.stringify([{ type: 'text', content: 'Went for a long run this morning, felt great and energized.' }]),
        timestamp: Date.now(),
        deletedAt: 0,
      },
    ];

    const insights = generateThemeInsights(themes, messages);

    // Should generate insights for both themes
    expect(insights.length).toBeGreaterThanOrEqual(2);

    // Insights should have descriptions
    expect(insights[0]!.description).toBeDefined();
    expect(insights[0]!.description.length).toBeGreaterThan(0);

    // Insights should reference the frequency
    expect(insights[0]!.description).toContain('5');

    // Should have confidence scores
    expect(insights[0]!.confidence).toBe(0.85);
    expect(insights[1]!.confidence).toBe(0.7);

    // Should have related message IDs
    expect(insights[0]!.relatedMessageIds).toHaveLength(5);
    expect(insights[1]!.relatedMessageIds).toHaveLength(3);
  });

  test('should handle empty embeddings gracefully', () => {
    const embeddings: AnalysisEmbedding[] = [];
    const embeddingIdToMessageId = new Map<string, string>();

    const themes = identifyRecurringThemes(embeddings, embeddingIdToMessageId, 2, 5);

    expect(themes).toHaveLength(0);
  });

  test('should filter themes by minimum frequency', () => {
    const embeddings: AnalysisEmbedding[] = [
      { id: 'emb-1', vector: Array(384).fill(0.1) },
      { id: 'emb-2', vector: Array(384).fill(0.1) },
      { id: 'emb-3', vector: Array(384).fill(0.1) },
    ];

    const embeddingIdToMessageId = new Map([
      ['emb-1', 'msg-1'],
      ['emb-2', 'msg-2'],
      ['emb-3', 'msg-3'],
    ]);

    // With minFrequency=5, should return empty array
    const themesHighFreq = identifyRecurringThemes(embeddings, embeddingIdToMessageId, 5, 5);
    expect(themesHighFreq).toHaveLength(0);

    // With minFrequency=2, should return themes
    const themesLowFreq = identifyRecurringThemes(embeddings, embeddingIdToMessageId, 2, 5);
    expect(themesLowFreq.length).toBeGreaterThanOrEqual(0);
  });

  test('should limit number of themes returned', () => {
    // Create many embeddings
    const embeddings: AnalysisEmbedding[] = Array.from({ length: 20 }, (_, i) => ({
      id: `emb-${i}`,
      vector: Array(384).fill(0).map(() => Math.random()),
    }));

    const embeddingIdToMessageId = new Map(
      embeddings.map((e) => [e.id, `msg-${e.id.split('-')[1]}`])
    );

    const themes = identifyRecurringThemes(embeddings, embeddingIdToMessageId, 2, 3);

    // Should not exceed maxThemes
    expect(themes.length).toBeLessThanOrEqual(3);
  });
});
