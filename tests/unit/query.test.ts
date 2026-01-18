import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QUERY_SYSTEM_PROMPT } from '@/services/ai/prompts';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Query Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryHistory', () => {
    it('should query summaries and return response with citations', async () => {
      const mockResponse = {
        response: 'Based on your journal entries, your sleep has been good.',
        citations: [
          { date: '2026-01-15', excerpt: 'Slept 8 hours last night' },
          { date: '2026-01-16', excerpt: 'Felt well-rested' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { queryHistory } = await import('@/services/ai/query');

      const summaries = [
        { date: '2026-01-15', rawContent: 'Summary for day 1' },
        { date: '2026-01-16', rawContent: 'Summary for day 2' },
      ];

      const result = await queryHistory('How was my sleep?', summaries, 'test-api-key');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/query', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    it('should throw error when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Query failed' }),
      });

      const { queryHistory } = await import('@/services/ai/query');

      const summaries = [{ date: '2026-01-15', rawContent: 'Summary' }];

      await expect(
        queryHistory('Test query', summaries, 'test-key')
      ).rejects.toThrow('Query failed');
    });

    it('should throw error for empty summaries', async () => {
      const { queryHistory } = await import('@/services/ai/query');

      await expect(
        queryHistory('Test query', [], 'test-key')
      ).rejects.toThrow('No summaries to query');
    });
  });
});

describe('Query Prompts', () => {
  it('should export QUERY_SYSTEM_PROMPT', () => {
    expect(QUERY_SYSTEM_PROMPT).toBeDefined();
    expect(typeof QUERY_SYSTEM_PROMPT).toBe('string');
  });

  it('should include key query instructions', () => {
    expect(QUERY_SYSTEM_PROMPT).toContain('summar');
    expect(QUERY_SYSTEM_PROMPT).toContain('date');
    expect(QUERY_SYSTEM_PROMPT).toContain('CITATIONS');
  });
});
