import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useChat } from '@tanstack/ai-react';
import type { UIMessage } from '@tanstack/ai';
import { useMessages } from './useMessages';
import { useNotes } from './useNotes';
import { useDay } from './useDay';
import { useSettings } from './useSettings';
import { getLocalTimezone, getTodayId } from '../utils/date.utils';
import {
  JOURNAL_SYSTEM_PROMPT,
  buildSystemPromptWithTools,
  JOURNAL_TOOLS,
} from '@/services/ai';
import { createRefBasedConnection, type StreamingConnectionConfig } from '@/services/ai/streaming-connection';
import type { Message } from '@/types/entities';

interface UseStreamingChatOptions {
  dayId: string;
  model?: string;
}

/**
 * Convert RxDB messages to TanStack AI UIMessage format
 */
function rxdbToUIMessages(messages: Message[]): UIMessage[] {
  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    parts: JSON.parse(msg.parts),
    createdAt: new Date(msg.timestamp),
  }));
}

export function useStreamingChat({ dayId, model }: UseStreamingChatOptions) {
  const {
    messages: rxdbMessages,
    isLoading: messagesLoading,
    addMessage,
    updateMessage,
    deleteAllMessages,
  } = useMessages(dayId);
  const { notes } = useNotes(dayId);
  const { createOrUpdateDay } = useDay(dayId);
  const { apiKey, systemPrompt } = useSettings();
  const [error, setError] = useState<string | null>(null);

  // === Ref-based connection config ===
  // The connection adapter reads from this ref at call time,
  // so it's always up-to-date without recreating the ChatClient.
  const configRef = useRef<StreamingConnectionConfig | null>(null);

  // Keep config ref in sync with latest values
  const activePrompt = useMemo(() => {
    const basePrompt = systemPrompt || JOURNAL_SYSTEM_PROMPT;
    return buildSystemPromptWithTools(basePrompt, {
      currentDate: getTodayId(),
      journalDate: dayId,
      notes,
    });
  }, [systemPrompt, dayId, notes]);

  // Update the config ref whenever dependencies change
  useEffect(() => {
    if (apiKey) {
      configRef.current = {
        apiKey,
        model: model || 'openai/gpt-4o',
        systemPrompt: activePrompt,
        tools: JOURNAL_TOOLS,
      };
    } else {
      configRef.current = null;
    }
  }, [apiKey, model, activePrompt]);

  // Conversation message IDs ref for tool execution (filtering current messages from search)
  const conversationMessageIdsRef = useRef<string[]>([]);
  useEffect(() => {
    conversationMessageIdsRef.current = rxdbMessages.map((m) => m.id);
  }, [rxdbMessages]);

  // Create the connection adapter ONCE (stable reference)
  // Tool calls are handled inside the adapter — no client tools needed.
  const connection = useMemo(
    () => createRefBasedConnection(configRef, conversationMessageIdsRef),
    [] // intentionally empty - connection reads from refs
  );

  // Track placeholder message for updating on completion
  const pendingPlaceholderRef = useRef<string | null>(null);
  // Track if we're actively streaming to prevent sync interference
  const isStreamingRef = useRef(false);

  // Refs for addMessage/updateMessage so callbacks don't cause re-creation
  const addMessageRef = useRef(addMessage);
  addMessageRef.current = addMessage;
  const updateMessageRef = useRef(updateMessage);
  updateMessageRef.current = updateMessage;

  // TanStack AI useChat - created once with stable connection
  // No client tools: tool execution is handled inside the connection adapter
  const chat = useChat({
    connection,
    onFinish: async (message) => {
      isStreamingRef.current = false;
      if (message.role === 'assistant') {
        const textContent = message.parts
          .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
          .map((p) => p.content)
          .join('');
        const parts = JSON.stringify(message.parts);
        const placeholderId = pendingPlaceholderRef.current;
        if (placeholderId) {
          await updateMessageRef.current(placeholderId, textContent, parts);
          pendingPlaceholderRef.current = null;
        } else {
          await addMessageRef.current('assistant', textContent, undefined, parts);
        }
      }
    },
    onError: (err) => {
      isStreamingRef.current = false;
      setError(err instanceof Error ? err.message : String(err));
    },
  });

  // === Sync RxDB → TanStack AI ===
  // Only sync when NOT actively streaming, to avoid resetting state mid-stream
  const initializedRef = useRef(false);
  const lastSyncedCountRef = useRef(0);

  useEffect(() => {
    if (messagesLoading || isStreamingRef.current) return;

    const rxdbCount = rxdbMessages.length;

    if (!initializedRef.current) {
      // First load: populate TanStack AI with existing messages
      const uiMsgs = rxdbToUIMessages(rxdbMessages);
      chat.setMessages(uiMsgs as Parameters<typeof chat.setMessages>[0]);
      initializedRef.current = true;
      lastSyncedCountRef.current = rxdbCount;
    } else if (rxdbCount !== lastSyncedCountRef.current && !chat.isLoading) {
      // External change (e.g., onFinish persisted, clear happened)
      const uiMsgs = rxdbToUIMessages(rxdbMessages);
      chat.setMessages(uiMsgs as Parameters<typeof chat.setMessages>[0]);
      lastSyncedCountRef.current = rxdbCount;
    }
  }, [rxdbMessages, messagesLoading, chat.isLoading]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || chat.isLoading) return;

      if (!apiKey) {
        setError('Please configure your OpenRouter API key in settings');
        return;
      }

      setError(null);
      isStreamingRef.current = true;

      try {
        // Ensure day exists
        await createOrUpdateDay(getLocalTimezone());

        // Persist user message to RxDB
        await addMessage('user', content, undefined, JSON.stringify([{ type: 'text', content }]));

        // Create placeholder for assistant response
        const assistantMessage = await addMessage('assistant', '...', undefined, JSON.stringify([{ type: 'text', content: '...' }]));
        pendingPlaceholderRef.current = assistantMessage.id;

        // Update sync tracking so the sync effect doesn't reset TanStack AI state
        lastSyncedCountRef.current = rxdbMessages.length + 2;

        // Send via TanStack AI (this adds user msg internally and starts streaming)
        await chat.sendMessage(content);
      } catch (err) {
        isStreamingRef.current = false;
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
      }
    },
    [chat, apiKey, createOrUpdateDay, addMessage, rxdbMessages.length]
  );

  const stopSending = useCallback(() => {
    isStreamingRef.current = false;
    chat.stop();
  }, [chat]);

  const clearMessages = useCallback(async () => {
    await deleteAllMessages();
    chat.clear();
    initializedRef.current = false;
    lastSyncedCountRef.current = 0;
  }, [deleteAllMessages, chat]);

  // Convert current RxDB messages for idle display
  const idleMessages = useMemo(() => {
    if (messagesLoading) return [];
    return rxdbToUIMessages(rxdbMessages);
  }, [rxdbMessages, messagesLoading]);

  return {
    // During streaming, show TanStack AI messages (real-time parts with streaming text).
    // When idle, show RxDB messages (source of truth for persistence).
    messages: chat.isLoading ? chat.messages : idleMessages,
    isLoading: messagesLoading,
    isSending: chat.isLoading,
    error,
    sendMessage,
    stopSending,
    clearMessages,
    needsApiKey: !apiKey,
    status: chat.status,
  };
}
