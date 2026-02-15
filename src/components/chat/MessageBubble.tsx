import type { UIMessage, MessagePart, ToolCallPart, ToolResultPart } from '@tanstack/ai';
import { formatTime } from '../../utils/date.utils';
import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';
import { ToolCallDisplay } from './ToolCallDisplay';

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const timestamp = message.createdAt ? message.createdAt.getTime() : Date.now();

  // Collect text content and tool parts
  const textContent = message.parts
    .filter((p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.content)
    .join('');

  const toolCallParts = message.parts.filter(
    (p): p is ToolCallPart => p.type === 'tool-call'
  );
  const toolResultParts = message.parts.filter(
    (p): p is ToolResultPart => p.type === 'tool-result'
  );

  // Build a map of tool results by toolCallId
  const toolResultMap = new Map<string, ToolResultPart>();
  for (const tr of toolResultParts) {
    toolResultMap.set(tr.toolCallId, tr);
  }

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted border border-border text-muted-foreground"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message Bubble */}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border text-card-foreground rounded-tl-sm"
        )}
      >
        {/* Tool calls (shown before text for assistant messages) */}
        {!isUser && toolCallParts.length > 0 && (
          <div>
            {toolCallParts.map((tc) => (
              <ToolCallDisplay
                key={tc.id}
                toolCall={tc}
                toolResult={toolResultMap.get(tc.id)}
              />
            ))}
          </div>
        )}

        {/* Text content */}
        {(textContent || toolCallParts.length === 0) && (
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {textContent || '...'}
          </div>
        )}

        <div
          className={cn(
            "text-xs mt-2 opacity-60",
            isUser ? "text-right" : "text-left"
          )}
        >
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
}
