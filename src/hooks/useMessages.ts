import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import type { Message, MessageRole, Category } from '../types/entities';

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
      categories?: Category[]
    ): Promise<Message> => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const message: Message = {
        id: crypto.randomUUID(),
        dayId,
        role,
        content,
        timestamp: Date.now(),
        categories: categories ?? [],
      };

      await db.messages.insert(message);

      // Update day's updatedAt
      const dayDoc = await db.days.findOne({ selector: { id: dayId } }).exec();
      if (dayDoc) {
        await dayDoc.patch({ updatedAt: message.timestamp });
      }

      return message;
    },
    [db, dayId]
  );

  const updateMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const messageDoc = await db.messages
        .findOne({ selector: { id: messageId } })
        .exec();

      if (messageDoc) {
        await messageDoc.patch({ content });
      }
    },
    [db]
  );

  return {
    messages,
    isLoading,
    addMessage,
    updateMessage,
  };
}
