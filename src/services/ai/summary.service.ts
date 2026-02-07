import type { Message } from '../../types/entities';
import type { JournalDatabase } from '../../db';
import { SUMMARY_SYSTEM_PROMPT } from './prompts';
import { getNotesForDay } from '../db/notes';
import { fetchWithRetry } from '@/utils/fetch';
import { aiRateLimiter, RateLimitError } from '@/utils/rate-limiter';
import { logger } from '@/utils/logger';

export interface NoteSummaryResponse {
  content: string;
}

export async function generateSummary(
  messages: Message[],
  date: string,
  apiKey: string,
  db: JournalDatabase,
  model?: string
): Promise<NoteSummaryResponse> {
  logger.debug('[generateSummary] Starting with', messages.length, 'messages');
  logger.debug('[generateSummary] Model:', model || 'openai/gpt-4o (default)');

  // Fetch same-day notes (excluding summary category)
  const allNotes = await getNotesForDay(db, date);
  const notes = allNotes.filter((note) => note.category !== 'summary');
  logger.debug('[generateSummary] Found', notes.length, 'notes for context');

  // Format notes into context string
  let notesContext = '';
  if (notes.length > 0) {
    notesContext = notes
      .map((note) => {
        const header = note.title ? `[${note.category}] ${note.title}` : `[${note.category}]`;
        return `${header}\n${note.content}`;
      })
      .join('\n\n');
  }

  // Sort and format conversation
  const conversationText = messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  logger.debug('[generateSummary] Conversation length:', conversationText.length, 'characters');
  logger.debug('[generateSummary] Notes context length:', notesContext.length, 'characters');

  // Build the prompt with notes context if available
  let userPrompt = `Please summarize the following journal conversation from ${date}:`;

  if (notesContext) {
    userPrompt += `\n\n[Today's Notes]\n${notesContext}\n\n[Journal Conversation]`;
  }

  userPrompt += `\n\n${conversationText}`;

  const requestBody = {
    model: model || 'openai/gpt-4o',
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  };

  logger.debug('[generateSummary] Making API request to OpenRouter...');

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
    body: JSON.stringify(requestBody),
    timeout: 90000, // 90 seconds for summary generation
    maxRetries: 2,
  });

  logger.debug('[generateSummary] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    logger.error('[generateSummary] Error response:', errorData);
    const errorMessage = errorData.error?.message || 'Summary generation failed';
    throw new Error(errorMessage);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  logger.debug('[generateSummary] Response data:', data);

  const content = data.choices[0]?.message?.content;
  if (!content) {
    logger.error('[generateSummary] No content in response');
    throw new Error('No response from AI');
  }

  logger.debug('[generateSummary] Generated content length:', content.length);

  // Return the markdown content directly
  return { content: content.trim() };
}
