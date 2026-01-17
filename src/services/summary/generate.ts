/**
 * Summary Generation Service
 * Handles generating daily summaries from chat messages
 */

import type { SummarySections, SummaryResponse } from '@/types';

interface MessageForSummary {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * Generate a summary from a day's messages
 */
export async function generateSummary(
  messages: MessageForSummary[],
  date: string,
  apiKey: string
): Promise<SummaryResponse> {
  if (!messages.length) {
    throw new Error('No messages to summarize');
  }

  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      date,
      apiKey,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorData.error || 'Summary generation failed');
  }

  return response.json() as Promise<SummaryResponse>;
}

/**
 * Parse summary sections from raw content
 */
export function parseSummarySections(
  rawContent: string
): SummarySections | null {
  try {
    return JSON.parse(rawContent) as SummarySections;
  } catch {
    return null;
  }
}
