import type { Message } from '../../types/entities';
import { formatTime } from '../../utils/date.utils';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-bubble ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-content">{message.content || '...'}</div>
      <div className="message-time">{formatTime(message.timestamp)}</div>
    </div>
  );
}
