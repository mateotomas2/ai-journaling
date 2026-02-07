/**
 * AI Chat Service
 * Handles sending messages to the OpenRouter API
 */

import type {
  ChatResponse,
  ChatMessage,
  ChatMessageWithTools,
  ChatResponseWithTools,
  Tool,
  ToolCall,
} from '@/types';
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

/**
 * Result from a chat message with tools
 */
export interface ChatWithToolsResult {
  content: string | null;
  toolCalls: ToolCall[] | null;
  finishReason: 'stop' | 'tool_calls' | 'length';
}

/**
 * Options for chat with tools
 */
export interface ChatWithToolsOptions {
  enableTools?: boolean;
  tools?: Tool[];
}

/**
 * Send a chat message with tool support to the AI and get a response
 */
export async function sendChatMessageWithTools(
  messages: ChatMessageWithTools[],
  apiKey: string,
  model?: string,
  options?: ChatWithToolsOptions
): Promise<ChatWithToolsResult> {
  // Check rate limit before making request
  if (!aiRateLimiter.canMakeRequest()) {
    const resetTime = aiRateLimiter.getResetTime();
    throw new RateLimitError(
      resetTime,
      `Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`
    );
  }

  aiRateLimiter.recordRequest();

  // Build request body
  const body: Record<string, unknown> = {
    model: model || 'openai/gpt-4o',
    messages,
  };

  // Add tools if enabled
  if (options?.enableTools && options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = 'auto';
  }

  const response = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'Reflekt Journal',
    },
    body: JSON.stringify(body),
    timeout: DEFAULT_TIMEOUT,
    maxRetries: 2,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorData.error || 'Failed to send message');
  }

  const data = (await response.json()) as ChatResponseWithTools;

  const choice = data.choices[0];
  if (!choice) {
    throw new Error('No response from AI');
  }

  const finishReason = choice.finish_reason;
  const assistantMessage = choice.message;

  // Handle tool calls
  if (finishReason === 'tool_calls' || assistantMessage.tool_calls) {
    return {
      content: assistantMessage.content,
      toolCalls: assistantMessage.tool_calls || null,
      finishReason: 'tool_calls',
    };
  }

  // Regular response
  return {
    content: assistantMessage.content,
    toolCalls: null,
    finishReason: finishReason as 'stop' | 'length',
  };
}

/**
 * Build messages array for tool-enabled chat
 */
export function buildChatMessagesWithTools(
  systemPrompt: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): ChatMessageWithTools[] {
  return [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
  ];
}
