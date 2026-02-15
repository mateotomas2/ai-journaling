import { getDatabase } from './database';
import { touchDay, getOrCreateDay } from './days';
import type { Message, Category } from '@/types';

/**
 * Add a message to a day's chat
 */
export async function addMessage(
  dayId: string,
  role: 'user' | 'assistant',
  content: string,
  categories?: Category[],
  timezone?: string,
  parts?: string
): Promise<Message> {
  const db = getDatabase();

  // Ensure day exists
  if (timezone) {
    await getOrCreateDay(dayId, timezone);
  }

  const message: Message = {
    id: crypto.randomUUID(),
    dayId,
    role,
    content,
    parts: parts ?? JSON.stringify([{ type: 'text', content }]),
    timestamp: Date.now(),
    ...(categories && { categories }),
  };

  const doc = await db.messages.insert(message);

  // Update day's updatedAt
  await touchDay(dayId);

  return doc.toJSON() as Message;
}

/**
 * Get all messages for a day, ordered by timestamp
 */
export async function getMessagesForDay(dayId: string): Promise<Message[]> {
  const db = getDatabase();
  const docs = await db.messages
    .find({
      selector: { dayId },
    })
    .sort({ timestamp: 'asc' })
    .exec();
  return docs.map((doc) => doc.toJSON() as Message);
}

/**
 * Get the last N messages for a day
 */
export async function getRecentMessages(
  dayId: string,
  limit: number
): Promise<Message[]> {
  const db = getDatabase();
  const docs = await db.messages
    .find({
      selector: { dayId },
    })
    .sort({ timestamp: 'desc' })
    .limit(limit)
    .exec();
  // Reverse to get chronological order
  return docs.map((doc) => doc.toJSON() as Message).reverse();
}

/**
 * Count messages for a day
 */
export async function countMessagesForDay(dayId: string): Promise<number> {
  const db = getDatabase();
  const docs = await db.messages
    .find({
      selector: { dayId },
    })
    .exec();
  return docs.length;
}

/**
 * Delete a message (for potential future use)
 */
export async function deleteMessage(messageId: string): Promise<boolean> {
  const db = getDatabase();
  const doc = await db.messages.findOne(messageId).exec();
  if (doc) {
    await doc.remove();
    return true;
  }
  return false;
}
