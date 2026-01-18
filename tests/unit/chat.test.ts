import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendChatMessage, buildChatMessages } from '@/services/ai/chat';
import { JOURNAL_SYSTEM_PROMPT } from '@/services/ai/prompts';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Chat Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendChatMessage', () => {
    it('should send messages to API and return response', async () => {
      const mockResponse = {
        id: 'gen-123',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello' },
      ];
      const apiKey = 'sk-or-test-key';

      const result = await sendChatMessage(messages, apiKey);

      expect(result).toBe('Hello! How can I help you today?');
      expect(mockFetch).toHaveBeenCalledWith('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, apiKey }),
      });
    });

    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid API key' }),
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];

      await expect(sendChatMessage(messages, 'invalid-key')).rejects.toThrow(
        'Invalid API key'
      );
    });

    it('should throw error when response has no content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];

      await expect(sendChatMessage(messages, 'test-key')).rejects.toThrow(
        'No response from AI'
      );
    });
  });

  describe('buildChatMessages', () => {
    it('should build messages with system prompt first', () => {
      const history = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      const result = buildChatMessages('System prompt here', history);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ role: 'system', content: 'System prompt here' });
      expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
      expect(result[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('should handle empty conversation history', () => {
      const result = buildChatMessages('System prompt', []);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'system', content: 'System prompt' });
    });
  });
});

describe('Prompts', () => {
  it('should export JOURNAL_SYSTEM_PROMPT', () => {
    expect(JOURNAL_SYSTEM_PROMPT).toBeDefined();
    expect(typeof JOURNAL_SYSTEM_PROMPT).toBe('string');
    expect(JOURNAL_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('should include key journal prompt elements', () => {
    expect(JOURNAL_SYSTEM_PROMPT).toContain('journal');
    expect(JOURNAL_SYSTEM_PROMPT).toContain('empathetic');
  });
});
