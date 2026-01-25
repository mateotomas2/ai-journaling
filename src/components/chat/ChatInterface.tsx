import { useState, useEffect } from 'react';
import { useJournalChat } from '../../hooks/useJournalChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ApiKeySetup } from './ApiKeySetup';
import { ChatHeader } from './ChatHeader';
import { useDatabase } from '@/hooks/useDatabase';
import { getChatModel, updateChatModel } from '@/services/settings/settings.service';

interface ChatInterfaceProps {
  dayId: string;
}

export function ChatInterface({ dayId }: ChatInterfaceProps) {
  const { db } = useDatabase();
  const [selectedModel, setSelectedModel] = useState<string>('openai/gpt-4o');

  // Load default chat model from settings
  useEffect(() => {
    async function loadDefaultModel() {
      if (!db) return;
      try {
        const defaultModel = await getChatModel(db);
        setSelectedModel(defaultModel);
      } catch (err) {
        console.error('Failed to load default chat model:', err);
      }
    }
    loadDefaultModel();
  }, [db]);

  // Handle model change - persist to database
  const handleModelChange = async (modelId: string) => {
    if (!db) return;
    try {
      await updateChatModel(db, modelId);
      setSelectedModel(modelId);
    } catch (err) {
      console.error('Failed to update chat model:', err);
    }
  };

  const {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    stopSending,
    needsApiKey,
  } = useJournalChat({ dayId, model: selectedModel });

  if (needsApiKey) {
    return <ApiKeySetup />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
      />
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
