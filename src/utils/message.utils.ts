import type { Message } from '../types/entities';
import type { ChatMessage } from '../types/ai';

export function messagesToChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export function sortMessagesByTimestamp(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp);
}
