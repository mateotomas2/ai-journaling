import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SUMMARY_SYSTEM_PROMPT } from '@/services/ai/prompts';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Summary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSummary', () => {
    it('should generate summary from messages', async () => {
      const mockResponse = {
        summary: {
          journal: 'Had a productive day at work.',
          insights: 'Realized I work better in the morning.',
          health: 'Slept 7 hours, felt energetic.',
          dreams: 'No dreams recorded for this day.',
        },
        rawContent: 'Summary content...',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { generateSummary } = await import('@/services/summary/generate');

      const messages = [
        { role: 'user' as const, content: 'I had a productive day', timestamp: Date.now() },
        { role: 'assistant' as const, content: 'That sounds great!', timestamp: Date.now() },
      ];

      const result = await generateSummary(messages, '2026-01-17', 'test-api-key');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/summary', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    it('should throw error when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Summary generation failed' }),
      });

      const { generateSummary } = await import('@/services/summary/generate');

      const messages = [
        { role: 'user' as const, content: 'Test message', timestamp: Date.now() },
      ];

      await expect(
        generateSummary(messages, '2026-01-17', 'test-key')
      ).rejects.toThrow('Summary generation failed');
    });

    it('should return empty summary for no messages', async () => {
      const { generateSummary } = await import('@/services/summary/generate');

      await expect(generateSummary([], '2026-01-17', 'test-key')).rejects.toThrow(
        'No messages to summarize'
      );
    });
  });

  describe('shouldGenerateSummary', () => {
    it('should return true when day has ended and no summary exists', async () => {
      const { shouldGenerateSummary } = await import('@/services/summary/trigger');

      // Yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const [dayId] = yesterday.toISOString().split('T');

      const result = shouldGenerateSummary(dayId ?? '2026-01-16', false, true);

      expect(result).toBe(true);
    });

    it('should return false when summary already exists', async () => {
      const { shouldGenerateSummary } = await import('@/services/summary/trigger');

      const result = shouldGenerateSummary('2026-01-16', true, true);

      expect(result).toBe(false);
    });

    it('should return false for today (day not ended)', async () => {
      const { shouldGenerateSummary } = await import('@/services/summary/trigger');

      const [today] = new Date().toISOString().split('T');
      const result = shouldGenerateSummary(today ?? '2026-01-17', false, true);

      expect(result).toBe(false);
    });

    it('should return false when no messages exist', async () => {
      const { shouldGenerateSummary } = await import('@/services/summary/trigger');

      const result = shouldGenerateSummary('2026-01-16', false, false);

      expect(result).toBe(false);
    });
  });
});

describe('Summary Prompts', () => {
  it('should export SUMMARY_SYSTEM_PROMPT', () => {
    expect(SUMMARY_SYSTEM_PROMPT).toBeDefined();
    expect(typeof SUMMARY_SYSTEM_PROMPT).toBe('string');
  });

  it('should include key summary sections', () => {
    expect(SUMMARY_SYSTEM_PROMPT).toContain('Journal');
    expect(SUMMARY_SYSTEM_PROMPT).toContain('Insights');
    expect(SUMMARY_SYSTEM_PROMPT).toContain('Health');
    expect(SUMMARY_SYSTEM_PROMPT).toContain('Dreams');
  });

  it('should request JSON response', () => {
    expect(SUMMARY_SYSTEM_PROMPT).toContain('JSON');
  });
});
