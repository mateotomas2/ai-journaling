import type { Message, Note } from '../../types';
import { REGENERATE_NOTES_SYSTEM_PROMPT } from './prompts';
import { fetchWithRetry } from '@/utils/fetch';
import { aiRateLimiter, RateLimitError } from '@/utils/rate-limiter';
import { logger } from '@/utils/logger';

export interface GeneratedNote {
  id: string;
  title: string;
  content: string;
  category: string;
}

export interface RegenerateNotesResponse {
  notes: GeneratedNote[];
}

export async function regenerateNotes(
  messages: Message[],
  existingNotes: Note[],
  dayId: string,
  apiKey: string,
  model?: string
): Promise<RegenerateNotesResponse> {
  logger.debug('[regenerateNotes] Starting with', messages.length, 'messages and', existingNotes.length, 'notes');
  logger.debug('[regenerateNotes] Model:', model || 'openai/gpt-4o (default)');

  // Format messages chronologically
  const conversationText = messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  // Format existing notes with categories
  const notesText = existingNotes
    .filter((note) => note.category !== 'summary')
    .map((note) => {
      const header = note.title ? `[${note.category}] ${note.title}` : `[${note.category}]`;
      return `${header}\n${note.content}`;
    })
    .join('\n\n');

  logger.debug('[regenerateNotes] Conversation length:', conversationText.length, 'characters');
  logger.debug('[regenerateNotes] Notes text length:', notesText.length, 'characters');

  // Build user prompt based on available content
  let userPrompt: string;

  if (!conversationText && !notesText) {
    throw new Error('No content to regenerate notes from');
  }

  userPrompt = `Please analyze and reorganize the following journal content from ${dayId} into well-organized notes grouped by topic:\n\n<Journal Conversation>\n${conversationText}\n\n<Notes>\n${notesText}\n</Notes>`;

  console.log('[regenerateNotes] User prompt:', userPrompt);

  const requestBody = {
    model: model || 'openai/gpt-4o',
    messages: [
      { role: 'system', content: REGENERATE_NOTES_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  };

  logger.debug('[regenerateNotes] Making API request to OpenRouter...');

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
    timeout: 90000,
    maxRetries: 2,
  });

  logger.debug('[regenerateNotes] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    logger.error('[regenerateNotes] Error response:', errorData);
    const errorMessage = errorData.error?.message || 'Note regeneration failed';
    throw new Error(errorMessage);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  logger.debug('[regenerateNotes] Response data:', data);

  const content = data.choices[0]?.message?.content;
  if (!content) {
    logger.error('[regenerateNotes] No content in response');
    throw new Error('No response from AI');
  }

  logger.debug('[regenerateNotes] Generated content:', content);

  // Parse JSON response
  let parsed: { notes: Array<{ title: string; category: string; content: string }> };
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    logger.error('[regenerateNotes] Failed to parse JSON response:', err);
    throw new Error('Failed to parse AI response');
  }

  if (!parsed.notes || !Array.isArray(parsed.notes)) {
    logger.error('[regenerateNotes] Invalid response structure:', parsed);
    throw new Error('Invalid response structure from AI');
  }

  // Transform to GeneratedNote with unique IDs
  const notes: GeneratedNote[] = parsed.notes.map((note, index) => ({
    id: `generated-${Date.now()}-${index}`,
    title: note.title || '',
    category: note.category || 'general',
    content: note.content || '',
  }));

  logger.debug('[regenerateNotes] Generated', notes.length, 'notes');

  return { notes };
}
