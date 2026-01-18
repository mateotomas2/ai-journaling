import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { validateSystemPrompt } from '@/services/settings/validation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MAX_PROMPT_LENGTH = 5000;

export function PromptCustomization() {
  const { systemPrompt, isLoading, saveSystemPrompt: updateSystemPrompt, resetPrompt: resetSystemPrompt } = useSettings();
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
      setError(`System prompt is too long (${newValue.length} chars). Maximum is ${MAX_PROMPT_LENGTH} characters.`);
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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>System Prompt Customization</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const charCount = editValue.length;
  const isOverLimit = charCount > MAX_PROMPT_LENGTH;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>System Prompt Customization</CardTitle>
        <CardDescription>
          Customize the AI's behavior by modifying the system prompt. This will affect how the AI responds
          to your journal entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="system-prompt-input">System Prompt</Label>
          <Textarea
            id="system-prompt-input"
            value={editValue}
            onChange={handleChange}
            className={error || isOverLimit ? 'border-destructive min-h-[200px]' : 'min-h-[200px]'}
            rows={8}
            placeholder="Enter your custom system prompt..."
            aria-label="System prompt"
          />
          <div className="flex justify-end text-xs text-muted-foreground">
            <span className={isOverLimit ? 'text-destructive font-medium' : ''}>
              {charCount} / {MAX_PROMPT_LENGTH}
            </span>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isOverLimit}
            aria-label="Save system prompt"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            aria-label="Reset to default"
          >
            Reset to Default
          </Button>
        </div>

        <div className="pt-4 border-t text-sm text-muted-foreground italic">
          <p>
            <strong className="not-italic text-primary">Tip:</strong> The system prompt guides the AI's tone, style, and focus when responding
            to your journal entries. Experiment to find what works best for you!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
