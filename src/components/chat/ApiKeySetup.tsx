import { useState, type FormEvent } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { validateApiKey } from '@/services/settings/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

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
    <div className="flex items-center justify-center p-4 h-full bg-muted/20">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>OpenRouter API Key Required</CardTitle>
          <CardDescription>
            To use the AI journaling feature, you need to provide your OpenRouter API key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Get your API key from{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              openrouter.ai/keys
            </a>
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                disabled={isLoading}
                autoFocus
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" className="w-full" disabled={isLoading || !apiKey.trim()}>
              {isLoading ? 'Saving...' : 'Save API Key'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            Your API key is stored locally and never sent to our servers. It's
            only used to communicate directly with OpenRouter.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
