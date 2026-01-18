import { useState, type FormEvent } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, BookOpen } from 'lucide-react';

export function UnlockPage() {
  const { unlock, isLoading, error } = useDatabase();
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      await unlock(password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Journal</h1>
          <p className="text-sm text-muted-foreground">Your private space for reflection</p>
        </div>

        {/* Unlock Card */}
        <Card className="shadow-xl border-border/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Welcome Back</CardTitle>
            <CardDescription>Enter your password to unlock your journal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                disabled={isLoading}
                className="h-11"
              />
              <Button type="submit" className="w-full h-11" disabled={isLoading || !password.trim()}>
                {isLoading ? 'Unlocking...' : 'Unlock Journal'}
              </Button>
            </form>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Your data is encrypted and stored locally
        </p>
      </div>
    </div>
  );
}
