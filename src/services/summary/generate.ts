/**
 * Summary Generation Service
 * Handles generating daily summaries from chat messages
 */

import type { SummarySections } from '@/types';

// Re-export the main generateSummary function from the AI service
export { generateSummary } from '../ai/summary.service';

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
