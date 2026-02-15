import { useEffect, useRef } from 'react';
import type { UIMessage } from '@tanstack/ai';
import { MessageBubble } from './MessageBubble';
import { Loading } from '@/components/common/Loading';

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col justify-center items-center p-4">
        <Loading message="Loading messages..." />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center text-center p-4 text-muted-foreground">
        <p className="mb-2 font-medium">Welcome to your journal!</p>
        <p>Start by sharing how your day is going, what's on your mind, or anything you'd like to reflect on.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
