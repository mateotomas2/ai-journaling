import type { QueryResponse } from '@/types';
import { QUERY_SYSTEM_PROMPT } from './prompts';
import { fetchWithRetry } from '@/utils/fetch';
import { aiRateLimiter, RateLimitError } from '@/utils/rate-limiter';

interface SummaryForQuery {
  date: string;
  rawContent: string;
}

/**
 * Query historical summaries with natural language
 */
export async function queryHistory(
  query: string,
  summaries: SummaryForQuery[],
  apiKey: string
): Promise<QueryResponse> {
  if (!summaries.length) {
    throw new Error('No summaries to query');
  }

  const summaryContext = summaries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => `=== ${s.date} ===\n${s.rawContent}`)
    .join('\n\n');

  // Check rate limit before making request
  if (!aiRateLimiter.canMakeRequest()) {
    const resetTime = aiRateLimiter.getResetTime();
    throw new RateLimitError(
      resetTime,
      `Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`
    );
  }

  aiRateLimiter.recordRequest();

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'Reflekt Journal',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        { role: 'system', content: QUERY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here are my journal summaries:\n\n${summaryContext}\n\nMy question: ${query}`,
        },
      ],
    }),
    timeout: 60000,
    maxRetries: 2,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    const errorMessage = errorData.error?.message || 'Query failed';
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const fullContent = data.choices[0]?.message?.content ?? '';

  // Parse citations from response
  const citationSplit = fullContent.split('---CITATIONS---');
  const responseText = citationSplit[0]?.trim() ?? fullContent;
  let citations: Array<{ date: string; excerpt: string }> = [];

  if (citationSplit[1]) {
    try {
      citations = JSON.parse(citationSplit[1].trim());
    } catch {
      // Ignore citation parsing errors
    }
  }

  return { response: responseText, citations };
}
