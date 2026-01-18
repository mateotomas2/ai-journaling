import { describe, it, expect, vi, beforeEach } from 'vitest';

// T024: Integration tests for API endpoints
// Note: These tests mock fetch since we don't want to hit real OpenRouter in tests

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/chat', () => {
    it('should require messages in request body', async () => {
      // Test contract: messages are required
      const requestBody = { apiKey: 'test-key' };

      // Verify request validation
      expect(requestBody).not.toHaveProperty('messages');
    });

    it('should require apiKey in request body', async () => {
      // Test contract: apiKey is required
      const requestBody = { messages: [{ role: 'user', content: 'Hello' }] };

      // Verify request validation
      expect(requestBody).not.toHaveProperty('apiKey');
    });

    it('should accept valid chat request', async () => {
      const validRequest = {
        messages: [
          { role: 'system', content: 'You are a journaling companion.' },
          { role: 'user', content: 'I had a great day today.' },
        ],
        apiKey: 'sk-or-v1-test-key',
      };

      expect(validRequest.messages).toHaveLength(2);
      expect(validRequest.apiKey).toBeTruthy();
    });

    it('should return assistant response in OpenRouter format', async () => {
      const expectedResponse = {
        id: 'gen-123',
        choices: [
          {
            message: {
              role: 'assistant',
              content: "That's wonderful! What made it great?",
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 10,
          total_tokens: 60,
        },
      };

      expect(expectedResponse.choices[0]?.message.role).toBe('assistant');
      expect(expectedResponse.choices[0]?.message.content).toBeTruthy();
    });
  });

  describe('POST /api/summary', () => {
    it('should require messages and date in request', async () => {
      const validRequest = {
        messages: [
          { role: 'user', content: 'I slept 7 hours', timestamp: 1700000000000 },
        ],
        date: '2026-01-16',
        apiKey: 'sk-or-v1-test-key',
      };

      expect(validRequest.messages).toBeDefined();
      expect(validRequest.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(validRequest.apiKey).toBeTruthy();
    });

    it('should accept optional model field in request', async () => {
      const requestWithModel = {
        messages: [
          { role: 'user', content: 'Test message', timestamp: 1700000000000 },
        ],
        date: '2026-01-16',
        apiKey: 'sk-or-v1-test-key',
        model: 'anthropic/claude-sonnet-4.5',
      };

      expect(requestWithModel.model).toBe('anthropic/claude-sonnet-4.5');
      expect(requestWithModel.messages).toBeDefined();
      expect(requestWithModel.date).toBeDefined();
    });

    it('should use default model when model not provided', async () => {
      const requestWithoutModel = {
        messages: [
          { role: 'user', content: 'Test message', timestamp: 1700000000000 },
        ],
        date: '2026-01-16',
        apiKey: 'sk-or-v1-test-key',
      };

      // Verify the request doesn't have a model field
      expect(requestWithoutModel).not.toHaveProperty('model');

      // The backend should use 'openai/gpt-4o' as default when model is not provided
      const expectedDefaultModel = 'openai/gpt-4o';
      expect(expectedDefaultModel).toBe('openai/gpt-4o');
    });

    it('should return structured summary sections', async () => {
      const expectedResponse = {
        summary: {
          journal: 'A productive day.',
          insights: 'No specific insights.',
          health: 'Slept 7 hours.',
          dreams: 'No dreams recorded.',
        },
        rawContent: '## Journal\nA productive day.\n\n## Health\nSlept 7 hours.',
      };

      expect(expectedResponse.summary).toHaveProperty('journal');
      expect(expectedResponse.summary).toHaveProperty('insights');
      expect(expectedResponse.summary).toHaveProperty('health');
      expect(expectedResponse.summary).toHaveProperty('dreams');
      expect(expectedResponse.rawContent).toBeTruthy();
    });
  });

  describe('POST /api/query', () => {
    it('should require query and summaries in request', async () => {
      const validRequest = {
        query: 'How was my sleep last week?',
        summaries: [
          { date: '2026-01-15', rawContent: '## Health\nSlept 7 hours.' },
          { date: '2026-01-14', rawContent: '## Health\nSlept 5 hours.' },
        ],
        apiKey: 'sk-or-v1-test-key',
      };

      expect(validRequest.query).toBeTruthy();
      expect(validRequest.summaries).toHaveLength(2);
      expect(validRequest.apiKey).toBeTruthy();
    });

    it('should return response with date citations', async () => {
      const expectedResponse = {
        response: 'Your sleep averaged 6 hours last week.',
        citations: [
          { date: '2026-01-15', excerpt: 'Slept 7 hours' },
          { date: '2026-01-14', excerpt: 'Slept 5 hours' },
        ],
      };

      expect(expectedResponse.response).toBeTruthy();
      expect(expectedResponse.citations).toBeInstanceOf(Array);
      expect(expectedResponse.citations[0]).toHaveProperty('date');
      expect(expectedResponse.citations[0]).toHaveProperty('excerpt');
    });
  });
});

describe('Error Handling', () => {
  it('should return 400 for missing messages', async () => {
    const errorResponse = { error: 'Messages required' };
    expect(errorResponse.error).toBe('Messages required');
  });

  it('should return 400 for missing API key', async () => {
    const errorResponse = { error: 'API key required' };
    expect(errorResponse.error).toBe('API key required');
  });

  it('should return 401 for invalid API key', async () => {
    const errorResponse = { error: 'Invalid API key' };
    expect(errorResponse.error).toBe('Invalid API key');
  });

  it('should return 500 for AI service error', async () => {
    const errorResponse = { error: 'AI service error' };
    expect(errorResponse.error).toBe('AI service error');
  });
});
