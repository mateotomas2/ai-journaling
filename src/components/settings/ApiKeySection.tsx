/**
 * API Key Section Component
 * Allows users to view and update their OpenRouter API key
 */

import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { validateApiKey } from '@/services/settings/validation';
import './ApiKeySection.css';

export function ApiKeySection() {
  const { apiKey, isLoading, saveApiKey } = useSettings();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Mask API key to show only last 4 characters
  const maskApiKey = (key: string | null): string => {
    if (!key) return '';
    if (key.length <= 4) return key;
    return `${key.slice(0, 9)}***${key.slice(-4)}`;
  };

  useEffect(() => {
    if (apiKey) {
      setEditValue(apiKey);
    }
  }, [apiKey]);

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(apiKey || '');
    setError('');
  };

  const handleSave = async () => {
    setError('');

    // Validate API key
    const validation = validateApiKey(editValue);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid API key');
      return;
    }

    // Save API key
    setIsSaving(true);
    try {
      await saveApiKey(editValue.trim());
      console.log('API key update completed in settings UI');
      setIsEditing(false);
      showToast('API key updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Save API key error:', errorMessage);
      showToast(`Failed to update API key: ${errorMessage}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="api-key-section">
        <h2>OpenRouter API Key</h2>
        <p className="api-key-description">Loading...</p>
      </div>
    );
  }

  return (
    <div className="api-key-section">
      <h2>OpenRouter API Key</h2>
      <p className="api-key-description">
        Your API key is encrypted and stored locally. It's used to communicate with OpenRouter's AI services.
      </p>

      <div className="api-key-field">
        <label htmlFor="api-key-input">API Key</label>
        <div className="api-key-input-group">
          <input
            id="api-key-input"
            type="text"
            value={isEditing ? editValue : maskApiKey(apiKey)}
            onChange={(e) => setEditValue(e.target.value)}
            disabled={!isEditing}
            className={error ? 'error' : ''}
            aria-label="API key"
          />
          {!isEditing && (
            <button
              type="button"
              onClick={handleEdit}
              className="btn-secondary"
              aria-label="Edit API key"
            >
              Edit
            </button>
          )}
          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary"
                aria-label="Save API key"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="btn-secondary"
                aria-label="Cancel editing"
              >
                Cancel
              </button>
            </>
          )}
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>

      <div className="api-key-info">
        <p>
          <strong>Don't have an API key?</strong> Get one from{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
            OpenRouter
          </a>
        </p>
        <p className="info-note">
          Note: Your API key is stored encrypted in your browser's local database and never sent to our servers.
        </p>
      </div>
    </div>
  );
}
