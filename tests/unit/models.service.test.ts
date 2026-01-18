import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Models Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchModels', () => {
    it('should fetch models from OpenRouter API', async () => {
      const mockModels = {
        data: [
          {
            id: 'openai/gpt-4o',
            name: 'GPT-4o',
            pricing: {
              prompt: '0.0000025',
              completion: '0.000010',
            },
            context_length: 128000,
          },
          {
            id: 'anthropic/claude-sonnet-4.5',
            name: 'Claude Sonnet 4.5',
            pricing: {
              prompt: '0.000003',
              completion: '0.000015',
            },
            context_length: 200000,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModels),
      });

      const { fetchModels } = await import('@/services/ai/models.service');

      const result = await fetchModels();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
      });
    });

    it('should return fallback models on API failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { fetchModels, FALLBACK_MODELS } = await import('@/services/ai/models.service');

      const result = await fetchModels();

      expect(result).toEqual(FALLBACK_MODELS);
    });

    it('should return fallback models on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { fetchModels, FALLBACK_MODELS } = await import('@/services/ai/models.service');

      const result = await fetchModels();

      expect(result).toEqual(FALLBACK_MODELS);
    });
  });

  describe('extractProvider', () => {
    it('should extract provider from model ID', async () => {
      const { extractProvider } = await import('@/services/ai/models.service');

      expect(extractProvider('openai/gpt-4o')).toBe('OpenAI');
      expect(extractProvider('anthropic/claude-sonnet-4.5')).toBe('Anthropic');
      expect(extractProvider('google/gemini-2.5-flash')).toBe('Google');
    });

    it('should handle provider name variations', async () => {
      const { extractProvider } = await import('@/services/ai/models.service');

      expect(extractProvider('meta-llama/llama-3-70b')).toBe('Meta Llama');
      expect(extractProvider('mistralai/mistral-large')).toBe('Mistral AI');
    });

    it('should return Unknown for unrecognized providers', async () => {
      const { extractProvider } = await import('@/services/ai/models.service');

      expect(extractProvider('unknown-provider/model')).toBe('Unknown Provider');
      expect(extractProvider('model-without-slash')).toBe('Unknown Provider');
    });
  });

  describe('transformToAIModel', () => {
    it('should transform OpenRouter API response to AIModel type', async () => {
      const apiModel = {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        pricing: {
          prompt: '0.0000025',
          completion: '0.000010',
        },
        context_length: 128000,
      };

      const { transformToAIModel } = await import('@/services/ai/models.service');

      const result = transformToAIModel(apiModel);

      expect(result).toEqual({
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        pricing: {
          prompt: '0.0000025',
          completion: '0.000010',
        },
        contextLength: 128000,
      });
    });

    it('should handle missing context_length', async () => {
      const apiModel = {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        pricing: {
          prompt: '0.0000025',
          completion: '0.000010',
        },
      };

      const { transformToAIModel } = await import('@/services/ai/models.service');

      const result = transformToAIModel(apiModel);

      expect(result.contextLength).toBeUndefined();
    });
  });
});
