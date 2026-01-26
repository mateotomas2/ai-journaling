import type { Message } from '../../types/entities';
import type { JournalDatabase } from '../../db';
import { SUMMARY_SYSTEM_PROMPT } from './prompts';
import { getNotesForDay } from '../db/notes';

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
  console.log('[generateSummary] Starting with', messages.length, 'messages');
  console.log('[generateSummary] Model:', model || 'openai/gpt-4o (default)');

  // Fetch same-day notes (excluding summary category)
  const allNotes = await getNotesForDay(db, date);
  const notes = allNotes.filter((note) => note.category !== 'summary');
  console.log('[generateSummary] Found', notes.length, 'notes for context');

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

  console.log('[generateSummary] Conversation length:', conversationText.length, 'characters');
  console.log('[generateSummary] Notes context length:', notesContext.length, 'characters');

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

  console.log('[generateSummary] Making API request to OpenRouter...');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://reflekt.app',
      'X-Title': 'Reflekt Journal',
    },
    body: JSON.stringify(requestBody),
  });

  console.log('[generateSummary] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    console.error('[generateSummary] Error response:', errorData);
    const errorMessage = errorData.error?.message || 'Summary generation failed';
    throw new Error(errorMessage);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  console.log('[generateSummary] Response data:', data);

  const content = data.choices[0]?.message?.content;
  if (!content) {
    console.error('[generateSummary] No content in response');
    throw new Error('No response from AI');
  }

  console.log('[generateSummary] Generated content length:', content.length);

  // Return the markdown content directly
  return { content: content.trim() };
}
