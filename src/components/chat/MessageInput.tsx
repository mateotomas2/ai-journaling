import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  isDisabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  /** Current message value (controlled) */
  value?: string;
  /** Callback when message changes */
  onChange?: (message: string) => void;
}

export function MessageInput({ onSend, isDisabled, isStreaming, onStop, value: controlledValue, onChange }: MessageInputProps) {
  // Support both controlled and uncontrolled modes
  const [internalMessage, setInternalMessage] = useState('');
  const isControlled = controlledValue !== undefined;
  const message = isControlled ? controlledValue : internalMessage;

  const handleMessageChange = (newMessage: string) => {
    if (isControlled) {
      onChange?.(newMessage);
    } else {
      setInternalMessage(newMessage);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isDisabled && !isStreaming) {
      onSend(message.trim());
      handleMessageChange('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // We need to call handleSubmit with a synthetic event or just call logic directly
      // FormEvent type might mismatch if we pass keyboard event directly, so let's call logic
      if (message.trim() && !isDisabled && !isStreaming) {
        onSend(message.trim());
        handleMessageChange('');
      }
    }
  };

  return (
    <form className="flex gap-3 items-end p-4 border-t border-border bg-card/50 backdrop-blur-sm" onSubmit={handleSubmit}>
      <Textarea
        value={message}
        onChange={(e) => handleMessageChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind?"
        disabled={isDisabled}
        className="min-h-[40px] max-h-[200px] resize-none py-2"
        rows={1}
      />
      {isStreaming ? (
        <Button
          type="button"
          onClick={onStop}
          variant="destructive"
          size="icon"
          className="mb-0.5 shrink-0"
        >
          <Square className="h-4 w-4" />
          <span className="sr-only">Stop</span>
        </Button>
      ) : (
        <Button
          type="submit"
          disabled={isDisabled || !message.trim()}
          size="icon"
          className="mb-0.5 shrink-0"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      )}
    </form>
  );
}
