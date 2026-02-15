import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStreamingChat } from '../../hooks/useStreamingChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ApiKeySetup } from './ApiKeySetup';
import { ModelSelectorIcon } from '../settings/ModelSelectorIcon';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDatabase } from '@/hooks/useDatabase';
import { useSettings } from '@/hooks/useSettings';
import { getChatModel, updateChatModel } from '@/services/settings/settings.service';

interface ChatInterfaceProps {
  dayId: string;
}

export function ChatInterface({ dayId }: ChatInterfaceProps) {
  const { db } = useDatabase();
  const { apiKey } = useSettings();
  const [selectedModel, setSelectedModel] = useState<string>('openai/gpt-4o');
  const [showConfirm, setShowConfirm] = useState(false);

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
    clearMessages,
    needsApiKey,
  } = useStreamingChat({ dayId, model: selectedModel });

  if (needsApiKey) {
    return <ApiKeySetup />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex-1 min-h-0">
        <MessageList messages={messages} isLoading={isLoading} />

        {messages.length > 0 && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-3 left-3 z-10 shadow-md h-8 w-8"
            aria-label="New chat"
            onClick={() => setShowConfirm(true)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

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
        endSlot={
          <ModelSelectorIcon
            value={selectedModel}
            onChange={handleModelChange}
            apiKey={apiKey ?? undefined}
          />
        }
      />

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start new chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all messages in the current chat session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={clearMessages}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
