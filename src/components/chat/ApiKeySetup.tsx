import { useState, type FormEvent } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { validateApiKey } from '@/services/settings/validation';
import './ApiKeySetup.css';

export function ApiKeySetup() {
  const { saveApiKey } = useSettings();
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Use the same validation as settings page
      const validation = validateApiKey(apiKey);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid API key');
        return;
      }

      await saveApiKey(apiKey.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save API key';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="api-key-setup">
      <div className="api-key-card">
        <h2>OpenRouter API Key Required</h2>
        <p>
          To use the AI journaling feature, you need to provide your OpenRouter
          API key.
        </p>
        <p className="api-key-info">
          Get your API key from{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
          >
            openrouter.ai/keys
          </a>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="apiKey">API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={isLoading || !apiKey.trim()}>
            {isLoading ? 'Saving...' : 'Save API Key'}
          </button>
        </form>

        <p className="api-key-note">
          Your API key is stored locally and never sent to our servers. It's
          only used to communicate directly with OpenRouter.
        </p>
      </div>
    </div>
  );
}
