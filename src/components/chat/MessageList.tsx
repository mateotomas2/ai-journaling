import { useEffect, useRef } from 'react';
import type { Message } from '../../types/entities';
import { MessageBubble } from './MessageBubble';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="message-list message-list-loading">
        Loading messages...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="message-list message-list-empty">
        <p>Welcome to your journal!</p>
        <p>Start by sharing how your day is going, what's on your mind, or anything you'd like to reflect on.</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
