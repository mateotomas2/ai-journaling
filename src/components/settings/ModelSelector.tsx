import { useState, useEffect } from 'react';
import { fetchModels, FALLBACK_MODELS } from '@/services/ai/models.service';
import type { AIModel } from '@/types/entities';
import './ModelSelector.css';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState<AIModel[]>(FALLBACK_MODELS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadModels() {
      try {
        setIsLoading(true);
        setHasError(false);
        const fetchedModels = await fetchModels();
        setModels(fetchedModels);
      } catch (error) {
        console.error('Failed to load models:', error);
        setHasError(true);
        setModels(FALLBACK_MODELS);
      } finally {
        setIsLoading(false);
      }
    }

    loadModels();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Filter models based on search term
  const filteredModels = models.filter((model) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      model.name.toLowerCase().includes(searchLower) ||
      model.provider.toLowerCase().includes(searchLower) ||
      model.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="model-selector">
      {hasError && (
        <p className="model-selector-error" role="alert">
          Unable to load models from API. Showing fallback list.
        </p>
      )}

      <div className="model-selector-field">
        <label htmlFor="model-search">Search Models</label>
        <input
          id="model-search"
          type="text"
          placeholder="Search by name, provider, or ID..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="model-selector-search"
        />
      </div>

      <div className="model-selector-field">
        <label htmlFor="model-select">Select Model</label>
        <select
          id="model-select"
          value={value}
          onChange={handleChange}
          className="model-selector-select"
          disabled={isLoading}
        >
          {filteredModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - ${model.pricing.prompt}/token
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <p className="model-selector-loading">Loading models...</p>
      )}
      {!isLoading && filteredModels.length === 0 && (
        <p className="model-selector-no-results">No models match your search.</p>
      )}
    </div>
  );
}
