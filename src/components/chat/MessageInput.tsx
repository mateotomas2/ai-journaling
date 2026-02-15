import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square, DollarSign } from 'lucide-react';
import { useApiUsage } from '../../hooks/useApiUsage';

interface MessageInputProps {
  onSend: (message: string) => void;
  isDisabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  /** Current message value (controlled) */
  value?: string;
  /** Callback when message changes */
  onChange?: (message: string) => void;
  /** Slot rendered to the right of the send button */
  endSlot?: ReactNode;
}

export function MessageInput({ onSend, isDisabled, isStreaming, onStop, value: controlledValue, onChange, endSlot }: MessageInputProps) {
  // Support both controlled and uncontrolled modes
  const [internalMessage, setInternalMessage] = useState('');
  const { usage } = useApiUsage();
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
    <form className="flex flex-col items-end border-t border-border bg-card/50 backdrop-blur-sm" onSubmit={handleSubmit}>
      <Textarea
        value={message}
        onChange={(e) => handleMessageChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind?"
        disabled={isDisabled}
        className="text-sm focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none border-none min-h-[40px] max-h-[200px] resize-none py-2"
        rows={1}
      />
      <div className="flex items-center">
        {usage && (
          <Link
            to="/settings"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
            title={usage.limit != null
              ? `Used $${usage.usage.toFixed(2)} of $${usage.limit.toFixed(2)}`
              : `Used $${usage.usage.toFixed(2)}`
            }
          >
            <DollarSign className="w-3 h-3 mr-[-5px]" />
            <span>{usage.usage.toFixed(2)}{usage.limit != null && (
              <span className="text-muted-foreground/60">/{usage.limit.toFixed(2)}</span>
            )}</span>
          </Link>
        )}
        {endSlot}
        {isStreaming ? (
          <Button
            type="button"
            onClick={onStop}
            variant="destructive"
            size="icon"
            className=" shrink-0"
          >
            <Square className="h-4 w-4" />
            <span className="sr-only">Stop</span>
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isDisabled || !message.trim()}
            size="icon"
            variant="link"
            className=" shrink-0"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        )}
      </div>
    </form>
  );
}
