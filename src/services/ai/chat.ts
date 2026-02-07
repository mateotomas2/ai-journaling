/**
 * AI Chat Service
 * Handles sending messages to the OpenRouter API
 */

import type { ChatResponse, ChatMessage } from '@/types';
import { fetchWithRetry } from '@/utils/fetch';
import { aiRateLimiter, RateLimitError } from '@/utils/rate-limiter';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT = 60000; // 60 seconds for AI responses

/**
 * Send a chat message to the AI and get a response
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string,
  model?: string
): Promise<string> {
  // Check rate limit before making request
  if (!aiRateLimiter.canMakeRequest()) {
    const resetTime = aiRateLimiter.getResetTime();
    throw new RateLimitError(
      resetTime,
      `Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`
    );
  }

  aiRateLimiter.recordRequest();

  const response = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'Reflekt Journal',
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-4o',
      messages,
    }),
    timeout: DEFAULT_TIMEOUT,
    maxRetries: 2,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorData.error || 'Failed to send message');
  }

  const data = (await response.json()) as ChatResponse;

  const assistantMessage = data.choices[0]?.message?.content;
  if (!assistantMessage) {
    throw new Error('No response from AI');
  }

  return assistantMessage;
}

/**
 * Build the messages array for the chat API
 * Includes system prompt and conversation history
 */
export function buildChatMessages(
  systemPrompt: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
  ];
}
