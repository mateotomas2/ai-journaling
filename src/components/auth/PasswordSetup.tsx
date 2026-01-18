import { useState } from 'react';
import { PasswordWarning } from './PasswordWarning';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PasswordSetupProps {
  onSetup: (password: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function PasswordSetup({
  onSetup,
  isLoading = false,
  error,
}: PasswordSetupProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (!showWarning) {
      setShowWarning(true);
      return;
    }

    await onSetup(password);
  };

  if (showWarning) {
    return (
      <PasswordWarning
        onConfirm={() => onSetup(password)}
        onCancel={() => setShowWarning(false)}
        isLoading={isLoading}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Reflekt</CardTitle>
        <CardDescription>Create a password to protect your journal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password (min 8 characters)"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              disabled={isLoading}
            />
          </div>

          {(localError || error) && (
            <p className="text-sm text-destructive">{localError || error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || !password || !confirmPassword}>
            {isLoading ? 'Setting up...' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
