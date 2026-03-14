import type { AIModel } from '@/types/entities';

// Curated top picks (quality/popularity)
export const FEATURED_MODEL_IDS = new Set([
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-opus-4-5',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-r1',
  'meta-llama/llama-3.1-70b-instruct',
  'x-ai/grok-2',
]);


export function isFreeModel(model: AIModel): boolean {
  return parseFloat(model.pricing.prompt) === 0 && parseFloat(model.pricing.completion) === 0;
}

/** Formats price as $/1M tokens, e.g. "$2.50/M" or "Free" */
export function formatPrice(pricePerToken: string): string {
  const n = parseFloat(pricePerToken);
  if (n === 0) return 'Free';
  const perMillion = n * 1_000_000;
  return `$${perMillion < 1 ? perMillion.toFixed(3) : perMillion.toFixed(2)}/M`;
}

export type SortOption = 'default' | 'price-asc' | 'price-desc';

export function sortModels(models: AIModel[], sort: SortOption): AIModel[] {
  if (sort === 'default') return models;
  return [...models].sort((a, b) => {
    const pa = parseFloat(a.pricing.prompt);
    const pb = parseFloat(b.pricing.prompt);
    return sort === 'price-asc' ? pa - pb : pb - pa;
  });
}

export type FilterOption = 'all' | 'top' | 'free';

export function filterModels(models: AIModel[], filter: FilterOption): AIModel[] {
  switch (filter) {
    case 'top': return models.filter(m => FEATURED_MODEL_IDS.has(m.id));
    case 'free': return models.filter(isFreeModel);
    default: return models;
  }
}

/**
 * Fallback list of curated AI models used when OpenRouter API is unavailable
 * These models represent a good mix of providers and pricing tiers
 */
export const FALLBACK_MODELS: AIModel[] = [
  {
    id: 'openai/gpt-4o',
    name: 'OpenAI: GPT-4o',
    provider: 'OpenAI',
    pricing: {
      prompt: '0.0000025',
      completion: '0.000010',
    },
    contextLength: 128000,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'OpenAI: GPT-4o-mini',
    provider: 'OpenAI',
    pricing: {
      prompt: '0.00000015',
      completion: '0.0000006',
    },
    contextLength: 128000,
  },
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'OpenAI: GPT-3.5 Turbo',
    provider: 'OpenAI',
    pricing: {
      prompt: '0.0000005',
      completion: '0.0000015',
    },
    contextLength: 16385,
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Anthropic: Claude Sonnet 4.5',
    provider: 'Anthropic',
    pricing: {
      prompt: '0.000003',
      completion: '0.000015',
    },
    contextLength: 200000,
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Google: Gemini 2.5 Flash',
    provider: 'Google',
    pricing: {
      prompt: '0.0000003',
      completion: '0.0000012',
    },
    contextLength: 1000000,
  },
];

/**
 * OpenRouter API model response interface
 */
interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
}

/**
 * Provider name mapping for common model prefixes
 */
const PROVIDER_MAP: Record<string, string> = {
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'google': 'Google',
  'meta-llama': 'Meta Llama',
  'mistralai': 'Mistral AI',
  'cohere': 'Cohere',
  'ai21': 'AI21',
  'amazon': 'Amazon',
  'deepseek': 'DeepSeek',
  'x-ai': 'xAI',
  'perplexity': 'Perplexity',
  'qwen': 'Qwen',
};

/**
 * Extract provider name from model ID
 * @param modelId - Model ID in format "provider/model-name"
 * @returns Provider display name
 */
export function extractProvider(modelId: string): string {
  const parts = modelId.split('/');
  if (parts.length < 2 || !parts[0]) {
    return 'Unknown Provider';
  }

  const providerId = parts[0].toLowerCase();
  return PROVIDER_MAP[providerId] || 'Unknown Provider';
}

/**
 * Transform OpenRouter API response to AIModel type
 * @param apiModel - Model from OpenRouter API
 * @returns AIModel with provider extracted
 */
export function transformToAIModel(apiModel: OpenRouterModel): AIModel {
  const model: AIModel = {
    id: apiModel.id,
    name: apiModel.name,
    provider: extractProvider(apiModel.id),
    pricing: {
      prompt: apiModel.pricing.prompt,
      completion: apiModel.pricing.completion,
    },
  };

  if (apiModel.context_length !== undefined) {
    model.contextLength = apiModel.context_length;
  }

  return model;
}

/**
 * Fetch available models from OpenRouter API
 * When an API key is provided, uses the authenticated /models/user endpoint
 * which returns only models available based on the user's account settings.
 * Falls back to FALLBACK_MODELS on error.
 * @param apiKey - Optional OpenRouter API key for authenticated filtering
 * @returns Array of AIModel objects
 */
export async function fetchModels(apiKey?: string): Promise<AIModel[]> {
  try {
    const url = apiKey
      ? 'https://openrouter.ai/api/v1/models/user'
      : 'https://openrouter.ai/api/v1/models';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.warn('OpenRouter API returned non-OK status, using fallback models');
      return FALLBACK_MODELS;
    }

    const data = await response.json() as { data: OpenRouterModel[] };
    return data.data.map(transformToAIModel);
  } catch (error) {
    console.error('Error fetching models from OpenRouter:', error);
    return FALLBACK_MODELS;
  }
}
