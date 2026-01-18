import { useJournalChat } from '../../hooks/useJournalChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ApiKeySetup } from './ApiKeySetup';

interface ChatInterfaceProps {
  dayId: string;
}

export function ChatInterface({ dayId }: ChatInterfaceProps) {
  const {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    stopSending,
    needsApiKey,
  } = useJournalChat({ dayId });

  if (needsApiKey) {
    return <ApiKeySetup />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <MessageList messages={messages} isLoading={isLoading} />
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-center text-sm">
          {error}
        </div>
      )}
      <MessageInput
        onSend={sendMessage}
        isDisabled={isLoading}
        isStreaming={isSending}
        onStop={stopSending}
      />
    </div>
  );
}
