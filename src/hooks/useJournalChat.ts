import { useState, useCallback, useRef } from 'react';
import { useMessages } from './useMessages';
import { useDay } from './useDay';
import { useSettings } from './useSettings';
import { getLocalTimezone } from '../utils/date.utils';
import { sendChatMessage, buildChatMessages, JOURNAL_SYSTEM_PROMPT } from '@/services/ai';

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

        // Build messages for API
        const conversationHistory = [...messages, userMessage].map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));
        // Use custom system prompt from settings, fallback to default
        const activePrompt = systemPrompt || JOURNAL_SYSTEM_PROMPT;
        const chatMessages = buildChatMessages(activePrompt, conversationHistory);

        // Send to API
        setIsSending(true);
        abortControllerRef.current = new AbortController();

        const responseContent = await sendChatMessage(chatMessages, apiKey, model);

        // Update the assistant message with the response
        await updateMessage(assistantMessage.id, responseContent);
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
    [messages, addMessage, updateMessage, createOrUpdateDay, isSending, apiKey, systemPrompt, model]
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
