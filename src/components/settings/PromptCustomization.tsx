/**
 * Prompt Customization Component
 * Allows users to customize and reset the AI system prompt
 */

import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { validateSystemPrompt } from '@/services/settings/validation';
import './PromptCustomization.css';

const MAX_PROMPT_LENGTH = 5000;

export function PromptCustomization() {
  const { systemPrompt, isLoading, updateSystemPrompt, resetSystemPrompt } = useSettings();
  const { showToast } = useToast();

  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (systemPrompt) {
      setEditValue(systemPrompt);
    }
  }, [systemPrompt]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setEditValue(newValue);

    // Show error immediately if over limit
    if (newValue.length > MAX_PROMPT_LENGTH) {
      setError(`System prompt is too long (${newValue.length} chars). Maximum is 5000 characters.`);
    } else {
      setError('');
    }
  };

  const handleSave = async () => {
    setError('');

    // Validate system prompt
    const validation = validateSystemPrompt(editValue);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid system prompt');
      return;
    }

    // Save system prompt
    setIsSaving(true);
    try {
      await updateSystemPrompt(editValue.trim());
      showToast('System prompt updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Save system prompt error:', errorMessage);
      showToast(`Failed to update system prompt: ${errorMessage}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await resetSystemPrompt();
      showToast('System prompt reset to default', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Reset system prompt error:', errorMessage);
      showToast(`Failed to reset system prompt: ${errorMessage}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="prompt-customization">
        <h2>System Prompt Customization</h2>
        <p className="prompt-description">Loading...</p>
      </div>
    );
  }

  const charCount = editValue.length;
  const isOverLimit = charCount > MAX_PROMPT_LENGTH;

  return (
    <div className="prompt-customization">
      <h2>System Prompt Customization</h2>
      <p className="prompt-description">
        Customize the AI's behavior by modifying the system prompt. This will affect how the AI responds
        to your journal entries.
      </p>

      <div className="prompt-field">
        <label htmlFor="system-prompt-input">System Prompt</label>
        <textarea
          id="system-prompt-input"
          value={editValue}
          onChange={handleChange}
          className={error || isOverLimit ? 'error' : ''}
          rows={8}
          placeholder="Enter your custom system prompt..."
          aria-label="System prompt"
        />
        <div className="prompt-meta">
          <span className={`char-count ${isOverLimit ? 'over-limit' : ''}`}>
            {charCount} / {MAX_PROMPT_LENGTH}
          </span>
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>

      <div className="prompt-actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isOverLimit}
          className="btn-primary"
          aria-label="Save system prompt"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isSaving}
          className="btn-secondary"
          aria-label="Reset to default"
        >
          Reset to Default
        </button>
      </div>

      <div className="prompt-info">
        <p className="info-note">
          <strong>Tip:</strong> The system prompt guides the AI's tone, style, and focus when responding
          to your journal entries. Experiment to find what works best for you!
        </p>
      </div>
    </div>
  );
}
