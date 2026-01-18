/**
 * AI Query Service
 * Handles querying historical summaries
 */

import type { QueryRequest, QueryResponse } from '@/types';

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

  const request: QueryRequest = {
    query,
    summaries,
    apiKey,
  };

  const response = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorData.error || 'Query failed');
  }

  return response.json() as Promise<QueryResponse>;
}
