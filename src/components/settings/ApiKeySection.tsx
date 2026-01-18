import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { validateApiKey } from '@/services/settings/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>OpenRouter API Key</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>OpenRouter API Key</CardTitle>
        <CardDescription>
          Your API key is encrypted and stored locally. It's used to communicate with OpenRouter's AI services.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key-input">API Key</Label>
          <div className="flex gap-2">
            <Input
              id="api-key-input"
              type="text"
              value={isEditing ? editValue : maskApiKey(apiKey)}
              onChange={(e) => setEditValue(e.target.value)}
              disabled={!isEditing}
              className={error ? 'border-destructive font-mono' : 'font-mono'}
              aria-label="API key"
            />
            {!isEditing && (
              <Button variant="secondary" onClick={handleEdit}>
                Edit
              </Button>
            )}
          </div>
          {isEditing && (
            <div className="flex gap-2 mt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="pt-4 border-t text-sm text-muted-foreground">
          <p className="mb-2">
            <strong>Don't have an API key?</strong> Get one from{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              OpenRouter
            </a>
          </p>
          <p className="italic text-xs opacity-80">
            Note: Your API key is stored encrypted in your browser's local database and never sent to our servers.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
