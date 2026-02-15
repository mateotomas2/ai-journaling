import { describe, it, expect } from 'vitest';
import { messagesToChatMessages, sortMessagesByTimestamp } from '../../src/utils/message.utils';
import type { Message } from '../../src/types/entities';

describe('message.utils', () => {
  const createMessage = (overrides: Partial<Message> = {}): Message => {
    const content = overrides.content ?? 'Test message';
    return {
      id: '1',
      dayId: '2026-01-16',
      role: 'user',
      content,
      parts: JSON.stringify([{ type: 'text', content }]),
      timestamp: Date.now(),
      deletedAt: 0,
      ...overrides,
    };
  };

  describe('messagesToChatMessages', () => {
    it('converts messages to chat format', () => {
      const messages: Message[] = [
        createMessage({ role: 'user', content: 'Hello' }),
        createMessage({ id: '2', role: 'assistant', content: 'Hi there' }),
      ];

      const chatMessages = messagesToChatMessages(messages);

      expect(chatMessages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]);
    });

    it('returns empty array for empty input', () => {
      expect(messagesToChatMessages([])).toEqual([]);
    });
  });

  describe('sortMessagesByTimestamp', () => {
    it('sorts messages by timestamp ascending', () => {
      const messages: Message[] = [
        createMessage({ id: '1', timestamp: 3000 }),
        createMessage({ id: '2', timestamp: 1000 }),
        createMessage({ id: '3', timestamp: 2000 }),
      ];

      const sorted = sortMessagesByTimestamp(messages);

      expect(sorted.map((m) => m.id)).toEqual(['2', '3', '1']);
    });

    it('does not mutate original array', () => {
      const messages: Message[] = [
        createMessage({ id: '1', timestamp: 2000 }),
        createMessage({ id: '2', timestamp: 1000 }),
      ];

      const sorted = sortMessagesByTimestamp(messages);

      expect(messages.map((m) => m.id)).toEqual(['1', '2']);
      expect(sorted.map((m) => m.id)).toEqual(['2', '1']);
    });
  });
});
