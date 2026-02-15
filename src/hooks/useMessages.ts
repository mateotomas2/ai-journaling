import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import type { Message, MessageRole, Category } from '../types/entities';
import { memoryService } from '../services/memory/search';

export function useMessages(dayId: string) {
  const { db } = useDatabase();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    const subscription = db.messages
      .find({
        selector: { dayId },
        sort: [{ timestamp: 'asc' }],
      })
      .$.subscribe((docs) => {
        setMessages(docs.map((doc) => {
          const json = doc.toJSON();
          return {
            ...json,
            categories: json.categories ? [...json.categories] : undefined,
          } as Message;
        }));
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [db, dayId]);

  const addMessage = useCallback(
    async (
      role: MessageRole,
      content: string,
      categories?: Category[],
      parts?: string
    ): Promise<Message> => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const message: Message = {
        id: crypto.randomUUID(),
        dayId,
        role,
        content,
        parts: parts ?? JSON.stringify([{ type: 'text', content }]),
        timestamp: Date.now(),
        categories: categories ?? [],
      };

      await db.messages.insert(message);

      // Update day's updatedAt
      const dayDoc = await db.days.findOne({ selector: { id: dayId } }).exec();
      if (dayDoc) {
        await dayDoc.patch({ updatedAt: message.timestamp });
      }

      // Automatically index message for semantic search (skip placeholders)
      // This happens asynchronously to avoid blocking message creation
      if (content && content !== '...') {
        memoryService.indexMessage(message).catch((error) => {
          console.error('[useMessages] Failed to index message for search:', error);
        });
      }

      return message;
    },
    [db, dayId]
  );

  const updateMessage = useCallback(
    async (messageId: string, content: string, parts?: string) => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const messageDoc = await db.messages
        .findOne({ selector: { id: messageId } })
        .exec();

      if (messageDoc) {
        await messageDoc.patch({
          content,
          ...(parts ? { parts } : {}),
        });

        // Re-index the message with updated content
        // This happens asynchronously to avoid blocking the update
        if (content && content !== '...') {
          memoryService.reindexMessage(messageId).catch((error) => {
            // If reindex fails (e.g., placeholder was never indexed), index fresh
            console.warn('[useMessages] Re-index failed, attempting fresh index:', error.message);
            const msg = messageDoc.toJSON() as Message;
            memoryService.indexMessage({ ...msg, content }).catch((err) => {
              console.error('[useMessages] Failed to index updated message:', err);
            });
          });
        }
      }
    },
    [db]
  );

  const deleteAllMessages = useCallback(
    async () => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const docs = await db.messages
        .find({ selector: { dayId } })
        .exec();

      await Promise.all(docs.map((doc) => doc.remove()));
    },
    [db, dayId]
  );

  return {
    messages,
    isLoading,
    addMessage,
    updateMessage,
    deleteAllMessages,
  };
}
