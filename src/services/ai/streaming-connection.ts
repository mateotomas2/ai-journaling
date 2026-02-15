/**
 * Custom TanStack AI connection adapter for direct OpenRouter streaming.
 * Calls the OpenRouter API directly from the browser (no backend needed)
 * and yields AG-UI protocol StreamChunk events.
 */

import { stream } from '@tanstack/ai-client';
import type { StreamChunk, UIMessage, ModelMessage, ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent } from '@tanstack/ai';
import type { ConnectionAdapter } from '@tanstack/ai-client';
import { aiRateLimiter, RateLimitError } from '@/utils/rate-limiter';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface StreamingConnectionOptions {
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

      // Check if message has tool calls
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
 * Create a TanStack AI connection adapter for direct OpenRouter streaming.
 */
export function createOpenRouterConnection(
  options: StreamingConnectionOptions
): ConnectionAdapter {
  return stream(async function* (messages): AsyncGenerator<StreamChunk> {
    // Rate limiting
    if (!aiRateLimiter.canMakeRequest()) {
      const resetTime = aiRateLimiter.getResetTime();
      throw new RateLimitError(
        resetTime,
        `Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`
      );
    }
    aiRateLimiter.recordRequest();

    const openRouterMessages = uiMessagesToOpenRouter(messages, options.systemPrompt);

    const body: Record<string, unknown> = {
      model: options.model,
      messages: openRouterMessages,
      stream: true,
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
        'X-Title': 'Reflekt Journal',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(errorData.error || `OpenRouter API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body from OpenRouter');
    }

    const runId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    // Emit run started
    yield {
      type: 'RUN_STARTED',
      runId,
      timestamp: Date.now(),
    } satisfies StreamChunk;

    // Emit text message start
    yield {
      type: 'TEXT_MESSAGE_START',
      messageId,
      role: 'assistant',
      timestamp: Date.now(),
    } satisfies StreamChunk;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finishReason: string | null = null;

    // Track tool calls being built up
    const toolCalls = new Map<number, { id: string; name: string; args: string }>();
    let hasEmittedToolStarts = new Set<number>();

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

          // Handle text content
          if (delta.content) {
            yield {
              type: 'TEXT_MESSAGE_CONTENT',
              messageId,
              delta: delta.content,
              timestamp: Date.now(),
            } satisfies StreamChunk;
          }

          // Handle tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;

              // Initialize tool call tracking
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: '', name: '', args: '' });
              }
              const tracked = toolCalls.get(idx)!;

              if (tc.id) tracked.id = tc.id;
              if (tc.function?.name) tracked.name = tc.function.name;
              if (tc.function?.arguments) tracked.args += tc.function.arguments;

              // Emit TOOL_CALL_START once we have the name
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

              // Emit args delta
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

    // Emit TOOL_CALL_END for all tool calls
    for (const [, tracked] of toolCalls) {
      yield {
        type: 'TOOL_CALL_END',
        toolCallId: tracked.id,
        toolName: tracked.name,
        input: tracked.args ? JSON.parse(tracked.args) : undefined,
        timestamp: Date.now(),
      } satisfies ToolCallEndEvent;
    }

    // Emit text message end
    yield {
      type: 'TEXT_MESSAGE_END',
      messageId,
      timestamp: Date.now(),
    } satisfies StreamChunk;

    // Emit run finished
    yield {
      type: 'RUN_FINISHED',
      runId,
      finishReason: (finishReason as 'stop' | 'length' | 'tool_calls' | null) || 'stop',
      timestamp: Date.now(),
    } satisfies StreamChunk;
  });
}
