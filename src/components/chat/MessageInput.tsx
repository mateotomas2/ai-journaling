import { useState, type FormEvent, type KeyboardEvent } from 'react';
import './MessageInput.css';

interface MessageInputProps {
  onSend: (message: string) => void;
  isDisabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
}

export function MessageInput({ onSend, isDisabled, isStreaming, onStop }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isDisabled && !isStreaming) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind?"
        disabled={isDisabled}
        rows={1}
      />
      {isStreaming ? (
        <button type="button" onClick={onStop} className="stop-button">
          Stop
        </button>
      ) : (
        <button type="submit" disabled={isDisabled || !message.trim()}>
          Send
        </button>
      )}
    </form>
  );
}
