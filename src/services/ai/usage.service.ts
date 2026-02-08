/**
 * OpenRouter API Key Usage Service
 * Fetches credit/usage info for the authenticated API key
 */

import { fetchWithTimeout } from '@/utils/fetch';

const OPENROUTER_AUTH_URL = 'https://openrouter.ai/api/v1/auth/key';

export interface ApiKeyUsage {
  /** Total credits used in USD */
  usage: number;
  /** Credit limit in USD, or null if unlimited */
  limit: number | null;
  /** Whether the key is free-tier */
  is_free_tier: boolean;
}

export async function fetchApiKeyUsage(apiKey: string): Promise<ApiKeyUsage | null> {
  try {
    const response = await fetchWithTimeout(OPENROUTER_AUTH_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 10000,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { data: ApiKeyUsage };
    return data.data;
  } catch {
    return null;
  }
}
