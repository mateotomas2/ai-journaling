/**
 * Custom TanStack AI connection adapter for direct OpenRouter streaming.
 * Calls the OpenRouter API directly from the browser (no backend needed)
 * and yields AG-UI protocol StreamChunk events.
 *
 * Tool calls are handled inside the adapter: when the model calls a tool,
 * this adapter executes it, sends the result back, and streams the follow-up
 * response — all within a single connection invocation. This avoids relying
 * on TanStack AI's client-tool continuation mechanism which conflicts with
 * the RxDB sync effect in useStreamingChat.
 */

import { stream } from '@tanstack/ai-client';
import type { StreamChunk, UIMessage, ModelMessage, ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent } from '@tanstack/ai';
import type { ConnectionAdapter } from '@tanstack/ai-client';
import { aiRateLimiter, RateLimitError } from '@/utils/rate-limiter';
import { executeToolCall } from './tools';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_TOOL_ROUNDS = 5;

export interface StreamingConnectionConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

interface OpenRouterSSEDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

interface OpenRouterSSEChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: OpenRouterSSEDelta;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Convert UIMessage parts to OpenRouter chat messages format
 */
function uiMessagesToOpenRouter(
  messages: Array<UIMessage> | Array<ModelMessage>,
  systemPrompt: string
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of messages) {
    if ('parts' in msg) {
      // UIMessage format
      const uiMsg = msg as UIMessage;
      if (uiMsg.role === 'system') continue;

      const toolCallParts = uiMsg.parts.filter(p => p.type === 'tool-call');
      const textParts = uiMsg.parts.filter(p => p.type === 'text');
      const toolResultParts = uiMsg.parts.filter(p => p.type === 'tool-result');

      if (uiMsg.role === 'user') {
        const content = textParts.map(p => p.type === 'text' ? p.content : '').join('');
        result.push({ role: 'user', content });
      } else if (uiMsg.role === 'assistant') {
        const content = textParts.map(p => p.type === 'text' ? p.content : '').join('') || null;

        if (toolCallParts.length > 0) {
          result.push({
            role: 'assistant',
            content,
            tool_calls: toolCallParts.map(tc => {
              if (tc.type !== 'tool-call') return null;
              return {
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              };
            }).filter(Boolean),
          });
        } else {
          result.push({ role: 'assistant', content });
        }

        // Add tool results as separate tool messages
        for (const tr of toolResultParts) {
          if (tr.type === 'tool-result') {
            result.push({
              role: 'tool',
              tool_call_id: tr.toolCallId,
              content: tr.content,
            });
          }
        }
      }
    } else {
      // ModelMessage format
      const modelMsg = msg as ModelMessage;
      result.push({
        role: modelMsg.role,
        content: modelMsg.content,
        ...(modelMsg.toolCalls && { tool_calls: modelMsg.toolCalls }),
        ...(modelMsg.toolCallId && { tool_call_id: modelMsg.toolCallId }),
      });
    }
  }

  return result;
}

/**
 * Parse an SSE line from OpenRouter into a parsed chunk
 */
function parseSSELine(line: string): OpenRouterSSEChunk | null {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6).trim();
  if (data === '[DONE]') return null;
  try {
    return JSON.parse(data) as OpenRouterSSEChunk;
  } catch {
    return null;
  }
}

/**
 * Result from streaming a single OpenRouter API call.
 */
interface StreamCallResult {
  finishReason: string | null;
  toolCalls: Map<number, { id: string; name: string; args: string }>;
}

/**
 * Stream a single OpenRouter API call, yielding AG-UI events.
 * Returns the collected tool calls and finish reason.
 */
async function* streamSingleCall(
  config: StreamingConnectionConfig,
  openRouterMessages: Array<Record<string, unknown>>,
  messageId: string,
): AsyncGenerator<StreamChunk, StreamCallResult> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: openRouterMessages,
    stream: true,
  };

  if (config.tools && config.tools.length > 0) {
    body.tools = config.tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'Reflekt Journal',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number } | string;
    };
    const errorMsg =
      typeof errorData.error === 'string'
        ? errorData.error
        : errorData.error?.message ?? `OpenRouter API error: ${response.status}`;
    throw new Error(errorMsg);
  }

  if (!response.body) {
    throw new Error('No response body from OpenRouter');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finishReason: string | null = null;

  const toolCalls = new Map<number, { id: string; name: string; args: string }>();
  const hasEmittedToolStarts = new Set<number>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const chunk = parseSSELine(trimmed);
        if (!chunk) continue;

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;

        if (delta.content) {
          yield {
            type: 'TEXT_MESSAGE_CONTENT',
            messageId,
            delta: delta.content,
            timestamp: Date.now(),
          } satisfies StreamChunk;
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;

            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: '', name: '', args: '' });
            }
            const tracked = toolCalls.get(idx)!;

            if (tc.id) tracked.id = tc.id;
            if (tc.function?.name) tracked.name = tc.function.name;
            if (tc.function?.arguments) tracked.args += tc.function.arguments;

            if (tracked.name && !hasEmittedToolStarts.has(idx)) {
              hasEmittedToolStarts.add(idx);
              yield {
                type: 'TOOL_CALL_START',
                toolCallId: tracked.id,
                toolName: tracked.name,
                index: idx,
                timestamp: Date.now(),
              } satisfies ToolCallStartEvent;
            }

            if (tc.function?.arguments) {
              yield {
                type: 'TOOL_CALL_ARGS',
                toolCallId: tracked.id,
                delta: tc.function.arguments,
                args: tracked.args,
                timestamp: Date.now(),
              } satisfies ToolCallArgsEvent;
            }
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { finishReason, toolCalls };
}

/**
 * Create a ref-based TanStack AI connection adapter for OpenRouter streaming.
 *
 * Takes a ref to the config so the connection adapter is stable (created once)
 * but always reads the latest config values when actually connecting.
 * This avoids ChatClient recreation when config changes.
 *
 * Tool calls are handled internally: the adapter executes tools and makes
 * follow-up API calls within a single generator invocation.
 */
export function createRefBasedConnection(
  configRef: { current: StreamingConnectionConfig | null },
  messageIdsRef: { current: string[] },
): ConnectionAdapter {
  return stream(async function* (messages): AsyncGenerator<StreamChunk> {
    const config = configRef.current;
    if (!config) {
      throw new Error('Please configure your OpenRouter API key in settings');
    }

    // Rate limiting
    if (!aiRateLimiter.canMakeRequest()) {
      const resetTime = aiRateLimiter.getResetTime();
      throw new RateLimitError(
        resetTime,
        `Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`
      );
    }
    aiRateLimiter.recordRequest();

    const runId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    yield {
      type: 'RUN_STARTED',
      runId,
      timestamp: Date.now(),
    } satisfies StreamChunk;

    yield {
      type: 'TEXT_MESSAGE_START',
      messageId,
      role: 'assistant',
      timestamp: Date.now(),
    } satisfies StreamChunk;

    // Build the initial message list from conversation history
    let openRouterMessages = uiMessagesToOpenRouter(messages, config.systemPrompt);
    let lastFinishReason: string | null = null;

    // Tool call loop: execute tools and make follow-up calls as needed
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const callGen = streamSingleCall(config, openRouterMessages, messageId);

      // Consume the generator, yielding all AG-UI events
      let result: StreamCallResult;
      while (true) {
        const next = await callGen.next();
        if (next.done) {
          result = next.value;
          break;
        }
        yield next.value;
      }

      lastFinishReason = result.finishReason;

      // If no tool calls, we're done
      if (result.finishReason !== 'tool_calls' || result.toolCalls.size === 0) {
        break;
      }

      // Execute tool calls and build tool result messages
      const toolCallMessages: Array<Record<string, unknown>> = [];
      const assistantToolCalls: Array<Record<string, unknown>> = [];

      for (const [, tracked] of result.toolCalls) {
        // Yield TOOL_CALL_END for UI display
        const toolResult = await executeToolCall(
          {
            id: tracked.id,
            type: 'function',
            function: { name: tracked.name, arguments: tracked.args },
          },
          messageIdsRef.current,
        );

        yield {
          type: 'TOOL_CALL_END',
          toolCallId: tracked.id,
          toolName: tracked.name,
          input: tracked.args ? JSON.parse(tracked.args) : undefined,
          result: toolResult.content,
          timestamp: Date.now(),
        } satisfies ToolCallEndEvent;

        assistantToolCalls.push({
          id: tracked.id,
          type: 'function',
          function: { name: tracked.name, arguments: tracked.args },
        });

        toolCallMessages.push({
          role: 'tool',
          tool_call_id: toolResult.tool_call_id,
          content: toolResult.content,
        });
      }

      // Append assistant tool call message + tool results to the conversation
      openRouterMessages.push({
        role: 'assistant',
        content: null,
        tool_calls: assistantToolCalls,
      });
      openRouterMessages.push(...toolCallMessages);

      // Rate limit follow-up calls
      if (!aiRateLimiter.canMakeRequest()) {
        const resetTime = aiRateLimiter.getResetTime();
        throw new RateLimitError(
          resetTime,
          `Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`
        );
      }
      aiRateLimiter.recordRequest();
    }

    yield {
      type: 'TEXT_MESSAGE_END',
      messageId,
      timestamp: Date.now(),
    } satisfies StreamChunk;

    yield {
      type: 'RUN_FINISHED',
      runId,
      finishReason: (lastFinishReason as 'stop' | 'length' | 'tool_calls' | null) || 'stop',
      timestamp: Date.now(),
    } satisfies StreamChunk;
  });
}
