import { useJournalChat } from '../../hooks/useJournalChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ApiKeySetup } from './ApiKeySetup';
import './ChatInterface.css';

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
    <div className="chat-interface">
      <MessageList messages={messages} isLoading={isLoading} />
      {error && <div className="chat-error">{error}</div>}
      <MessageInput
        onSend={sendMessage}
        isDisabled={isLoading}
        isStreaming={isSending}
        onStop={stopSending}
      />
    </div>
  );
}
