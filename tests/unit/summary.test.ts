import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SUMMARY_SYSTEM_PROMPT } from '@/services/ai/prompts';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock database
const mockDb = {
  notes: {
    find: vi.fn().mockReturnValue({
      selector: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  },
} as any;

describe('Summary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSummary', () => {
    it('should generate summary from messages', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: '## Events\n\nHad a productive day at work.\n\n## Insights\n\nRealized I work better in the morning.'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAIResponse),
      });

      const { generateSummary } = await import('@/services/summary/generate');

      const messages = [
        { id: '1', dayId: '2026-01-17', role: 'user' as const, content: 'I had a productive day', parts: JSON.stringify([{ type: 'text', content: 'I had a productive day' }]), timestamp: Date.now(), deletedAt: 0 },
        { id: '2', dayId: '2026-01-17', role: 'assistant' as const, content: 'That sounds great!', parts: JSON.stringify([{ type: 'text', content: 'That sounds great!' }]), timestamp: Date.now(), deletedAt: 0 },
      ];

      const result = await generateSummary(messages, '2026-01-17', 'test-api-key', mockDb);

      expect(result).toHaveProperty('content');
      expect(typeof result.content).toBe('string');
      expect(mockFetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/chat/completions', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('should accept optional summarizerModel parameter', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: '## Daily Summary\n\nDaily journal entry.'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAIResponse),
      });

      const { generateSummary } = await import('@/services/summary/generate');

      const messages = [
        { id: '1', dayId: '2026-01-17', role: 'user' as const, content: 'Test message', parts: JSON.stringify([{ type: 'text', content: 'Test message' }]), timestamp: Date.now(), deletedAt: 0 },
      ];

      await generateSummary(messages, '2026-01-17', 'test-api-key', mockDb, 'anthropic/claude-sonnet-4.5');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
          body: expect.stringContaining('anthropic/claude-sonnet-4.5'),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      if (!callArgs) throw new Error('Expected mock to be called');
      const bodyData = JSON.parse(callArgs[1].body);
      expect(bodyData.model).toBe('anthropic/claude-sonnet-4.5');
    });

    it('should use default model when not provided', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: '## Daily Summary\n\nDaily journal entry.'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAIResponse),
      });

      const { generateSummary } = await import('@/services/summary/generate');

      const messages = [
        { id: '1', dayId: '2026-01-17', role: 'user' as const, content: 'Test message', parts: JSON.stringify([{ type: 'text', content: 'Test message' }]), timestamp: Date.now(), deletedAt: 0 },
      ];

      await generateSummary(messages, '2026-01-17', 'test-api-key', mockDb);

      const callArgs = mockFetch.mock.calls[0];
      if (!callArgs) throw new Error('Expected mock to be called');
      const bodyData = JSON.parse(callArgs[1].body);
      expect(bodyData.model).toBe('openai/gpt-4o'); // Default model
    });

    it('should throw error when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Summary generation failed' } }),
      });

      const { generateSummary } = await import('@/services/summary/generate');

      const messages = [
        { id: '1', dayId: '2026-01-17', role: 'user' as const, content: 'Test message', parts: JSON.stringify([{ type: 'text', content: 'Test message' }]), timestamp: Date.now(), deletedAt: 0 },
      ];

      await expect(
        generateSummary(messages, '2026-01-17', 'test-key', mockDb)
      ).rejects.toThrow('Summary generation failed');
    });

    it('should handle empty messages array', async () => {
      const mockAIResponse = {
        choices: [{
          message: {
            content: '## Daily Summary\n\nNo entries for today.'
          }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAIResponse),
      });

      const { generateSummary } = await import('@/services/summary/generate');

      const result = await generateSummary([], '2026-01-17', 'test-key', mockDb);
      expect(result).toHaveProperty('content');
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

  it('should include key summary areas', () => {
    expect(SUMMARY_SYSTEM_PROMPT).toContain('events, activities, and experiences');
    expect(SUMMARY_SYSTEM_PROMPT).toContain('realizations, patterns');
    expect(SUMMARY_SYSTEM_PROMPT).toContain('Health');
    expect(SUMMARY_SYSTEM_PROMPT).toContain('Dreams');
  });

  it('should request markdown response', () => {
    expect(SUMMARY_SYSTEM_PROMPT).toContain('markdown');
    expect(SUMMARY_SYSTEM_PROMPT).toContain('no JSON'); // Explicitly says no JSON
  });
});
