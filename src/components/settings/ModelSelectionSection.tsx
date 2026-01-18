/**
 * Model Selection Section
 * Allows users to choose which AI model to use for summarization
 */

import { useState, useEffect } from 'react';
import { ModelSelector } from './ModelSelector';
import { useDatabase } from '@/hooks/useDatabase';
import { getSummarizerModel, updateSummarizerModel } from '@/services/settings/settings.service';
import './ModelSelectionSection.css';

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
      <div className="model-selection-section">
        <h2>AI Model Selection</h2>
        <p className="model-selection-description">Loading...</p>
      </div>
    );
  }

  return (
    <div className="model-selection-section">
      <h2>AI Model Selection</h2>
      <p className="model-selection-description">
        Choose which AI model to use for generating your daily summaries. Different models offer
        different trade-offs in cost, speed, and quality.
      </p>

      {error && <div className="error-message">{error}</div>}

      <ModelSelector value={selectedModel} onChange={handleModelChange} />

      <div className="model-selection-info">
        <p>
          Current selection: <strong>{selectedModel}</strong>
        </p>
        <p className="info-note">
          <strong>Tip:</strong> More expensive models typically provide higher quality summaries, while
          cheaper models are faster and more cost-effective for everyday use.
        </p>
      </div>
    </div>
  );
}
