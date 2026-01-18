import { useState, useEffect } from 'react';
import { ModelSelector } from './ModelSelector';
import { useDatabase } from '@/hooks/useDatabase';
import { getSummarizerModel, updateSummarizerModel } from '@/services/settings/settings.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ModelSelectionSection() {
  const { db } = useDatabase();
  const [selectedModel, setSelectedModel] = useState<string>('openai/gpt-4o');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Load current model selection on mount
  useEffect(() => {
    async function loadModel() {
      if (!db) {
        return;
      }
      try {
        setIsLoading(true);
        const model = await getSummarizerModel(db);
        setSelectedModel(model);
      } catch (err) {
        console.error('Failed to load summarizer model:', err);
        setError('Failed to load model selection');
      } finally {
        setIsLoading(false);
      }
    }

    loadModel();
  }, [db]);

  // Handle model selection change
  const handleModelChange = async (modelId: string) => {
    if (!db) {
      return;
    }
    try {
      setError('');
      await updateSummarizerModel(db, modelId);
      setSelectedModel(modelId);
    } catch (err) {
      console.error('Failed to update summarizer model:', err);
      setError('Failed to save model selection');
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI Model Selection</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>AI Model Selection</CardTitle>
        <CardDescription>
          Choose which AI model to use for generating your daily summaries. Different models offer
          different trade-offs in cost, speed, and quality.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <div className="text-destructive text-sm mb-4">{error}</div>}

        <ModelSelector value={selectedModel} onChange={handleModelChange} />

        <div className="mt-4 p-4 bg-muted/50 rounded-md border-l-4 border-primary">
          <p className="mb-2 text-sm">
            Current selection: <strong className="font-medium">{selectedModel}</strong>
          </p>
          <p className="text-xs text-muted-foreground italic">
            <strong className="text-primary not-italic">Tip:</strong> More expensive models typically provide higher quality summaries, while
            cheaper models are faster and more cost-effective for everyday use.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
