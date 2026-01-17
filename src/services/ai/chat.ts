/**
 * AI Chat Service
 * Handles sending messages to the OpenRouter API
 */

import type { ChatRequest, ChatResponse, ChatMessage } from '@/types';

/**
 * Send a chat message to the AI and get a response
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string
): Promise<string> {
  const request: ChatRequest = {
    messages,
    apiKey,
  };

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
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
