import { useState, useEffect } from 'react';
import { ModelSelector } from './ModelSelector';
import { useDatabase } from '@/hooks/useDatabase';
import { useSettings } from '@/hooks/useSettings';
import { getSummarizerModel, updateSummarizerModel, getChatModel, updateChatModel } from '@/services/settings/settings.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ModelSelectionSection() {
  const { db } = useDatabase();
  const { apiKey } = useSettings();
  const [summarizerModel, setSummarizerModel] = useState<string>('openai/gpt-4o');
  const [summarizerLoading, setSummarizerLoading] = useState(true);
  const [summarizerError, setSummarizerError] = useState<string>('');

  const [chatModel, setChatModel] = useState<string>('openai/gpt-4o');
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string>('');

  // Load current model selections on mount
  useEffect(() => {
    async function loadModels() {
      if (!db) {
        return;
      }
      try {
        setSummarizerLoading(true);
        setChatLoading(true);
        const [summarizer, chat] = await Promise.all([
          getSummarizerModel(db),
          getChatModel(db),
        ]);
        setSummarizerModel(summarizer);
        setChatModel(chat);
      } catch (err) {
        console.error('Failed to load models:', err);
        setSummarizerError('Failed to load summarizer model');
        setChatError('Failed to load chat model');
      } finally {
        setSummarizerLoading(false);
        setChatLoading(false);
      }
    }

    loadModels();
  }, [db]);

  // Handle summarizer model selection change
  const handleSummarizerChange = async (modelId: string) => {
    if (!db) {
      return;
    }
    try {
      setSummarizerError('');
      await updateSummarizerModel(db, modelId);
      setSummarizerModel(modelId);
    } catch (err) {
      console.error('Failed to update summarizer model:', err);
      setSummarizerError('Failed to save model selection');
    }
  };

  // Handle chat model selection change
  const handleChatChange = async (modelId: string) => {
    if (!db) {
      return;
    }
    try {
      setChatError('');
      await updateChatModel(db, modelId);
      setChatModel(modelId);
    } catch (err) {
      console.error('Failed to update chat model:', err);
      setChatError('Failed to save model selection');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>AI Model Selection</CardTitle>
        <CardDescription>
          Choose which AI models to use for chat and summaries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chat Model Selector */}
        <div>
          <h4 className="text-sm font-medium mb-2">Chat Model</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Default model for chat. You can override per-session in the chat interface.
          </p>
          {chatError && <div className="text-destructive text-sm mb-4">{chatError}</div>}
          {chatLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <ModelSelector value={chatModel} onChange={handleChatChange} apiKey={apiKey ?? undefined} />
          )}
        </div>

        <div className="border-t" />

        {/* Summarizer Model Selector */}
        <div>
          <h4 className="text-sm font-medium mb-2">Summarizer Model</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Used for generating daily summaries.
          </p>
          {summarizerError && <div className="text-destructive text-sm mb-4">{summarizerError}</div>}
          {summarizerLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <ModelSelector value={summarizerModel} onChange={handleSummarizerChange} apiKey={apiKey ?? undefined} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
