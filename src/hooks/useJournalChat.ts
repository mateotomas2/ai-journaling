import { useState, useCallback, useRef } from 'react';
import { useMessages } from './useMessages';
import { useDay } from './useDay';
import { useSettings } from './useSettings';
import { getLocalTimezone } from '../utils/date.utils';
import {
  sendChatMessageWithTools,
  buildChatMessagesWithTools,
  JOURNAL_SYSTEM_PROMPT,
  buildSystemPromptWithTools,
  JOURNAL_TOOLS,
  executeToolCall,
} from '@/services/ai';
import type { ChatMessageWithTools } from '@/types';

const MAX_TOOL_ITERATIONS = 3;

interface UseJournalChatOptions {
  dayId: string;
  model?: string;
}

export function useJournalChat({ dayId, model }: UseJournalChatOptions) {
  const { messages, isLoading: messagesLoading, addMessage, updateMessage } = useMessages(dayId);
  const { createOrUpdateDay } = useDay(dayId);
  const { apiKey, systemPrompt } = useSettings();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debug logging for API key state
  console.log('[useJournalChat] API key available:', !!apiKey);
  console.log('[useJournalChat] Using system prompt:', systemPrompt || 'default');

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) {
        return;
      }

      if (!apiKey) {
        setError('Please configure your OpenRouter API key in settings');
        return;
      }

      setError(null);

      try {
        // Ensure day exists
        await createOrUpdateDay(getLocalTimezone());

        // Add user message
        const userMessage = await addMessage('user', content);

        // Create placeholder for assistant response
        const assistantMessage = await addMessage('assistant', '...');

        // Build messages for API with tool support
        const conversationHistory = [...messages, userMessage].map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));
        // Use custom or default prompt, always append tool instructions
        const basePrompt = systemPrompt || JOURNAL_SYSTEM_PROMPT;
        const activePrompt = buildSystemPromptWithTools(basePrompt);
        const chatMessages: ChatMessageWithTools[] = buildChatMessagesWithTools(
          activePrompt,
          conversationHistory
        );

        // Send to API with tool calling loop
        setIsSending(true);
        abortControllerRef.current = new AbortController();

        let iterations = 0;
        let finalContent: string | null = null;

        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;
          console.log(`[useJournalChat] Tool iteration ${iterations}/${MAX_TOOL_ITERATIONS}`);

          const result = await sendChatMessageWithTools(chatMessages, apiKey, model, {
            enableTools: true,
            tools: JOURNAL_TOOLS,
          });

          // If no tool calls, we're done
          if (result.finishReason === 'stop' || result.finishReason === 'length') {
            finalContent = result.content;
            break;
          }

          // Handle tool calls
          if (result.finishReason === 'tool_calls' && result.toolCalls) {
            console.log(`[useJournalChat] Executing ${result.toolCalls.length} tool calls`);

            // Add the assistant message with tool calls
            chatMessages.push({
              role: 'assistant',
              content: result.content,
              tool_calls: result.toolCalls,
            });

            // Execute each tool call and add results
            for (const toolCall of result.toolCalls) {
              console.log(`[useJournalChat] Executing tool: ${toolCall.function.name}`);
              const toolResult = await executeToolCall(toolCall, dayId);
              console.log(`[useJournalChat] Tool result:`, toolResult);
              chatMessages.push({
                role: 'tool',
                content: toolResult.content,
                tool_call_id: toolResult.tool_call_id,
              });
            }

            // Continue loop to get final response
            continue;
          }

          // Unexpected state, break with whatever content we have
          finalContent = result.content;
          break;
        }

        if (iterations >= MAX_TOOL_ITERATIONS) {
          console.warn('[useJournalChat] Max tool iterations reached');
        }

        // Update the assistant message with the final response
        await updateMessage(assistantMessage.id, finalContent || 'Sorry, I could not generate a response.');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
      } finally {
        setIsSending(false);
        abortControllerRef.current = null;
      }
    },
    [messages, addMessage, updateMessage, createOrUpdateDay, isSending, apiKey, systemPrompt, model, dayId]
  );

  const stopSending = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    messages,
    isLoading: messagesLoading,
    isSending,
    error,
    sendMessage,
    stopSending,
    needsApiKey: !apiKey,
  };
}
