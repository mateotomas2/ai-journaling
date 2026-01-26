import { useEffect, useState, useRef } from 'react';
import { Fingerprint, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getBiometricName } from '@/services/biometric';
import type { BiometricType } from '@/services/biometric';

interface BiometricUnlockProps {
  biometricType: BiometricType;
  platformName?: string | undefined;
  onUnlock: () => Promise<boolean>;
  onSwitchToPassword: () => void;
  autoTrigger?: boolean;
  maxRetries?: number;
  onAttempted?: () => void;
}

export function BiometricUnlock({
  biometricType,
  platformName,
  onUnlock,
  onSwitchToPassword,
  autoTrigger = true,
  maxRetries = 3,
  onAttempted,
}: BiometricUnlockProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const hasTriggered = useRef(false);

  const biometricName = getBiometricName(biometricType);
  const icon =
    biometricType === 'face' ? (
      <ShieldCheck className="w-8 h-8 text-primary" />
    ) : (
      <Fingerprint className="w-8 h-8 text-primary" />
    );

  const attemptUnlock = async () => {
    // Prevent re-triggering after successful unlock
    if (unlocked) {
      return;
    }

    if (retryCount >= maxRetries) {
      setError(
        `Maximum attempts reached. Please use your password instead.`
      );
      return;
    }

    onAttempted?.();

    setIsLoading(true);
    setError(null);

    try {
      const success = await onUnlock();

      if (success) {
        // Only mark as unlocked on actual success
        setUnlocked(true);
      } else {
        // Authentication failed (returned false)
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);

        if (newRetryCount >= maxRetries) {
          setError(
            `Maximum attempts reached. Please use your password instead.`
          );
        }
      }
    } catch (err) {
      // Unexpected error (not from unlockWithBiometric which returns false instead of throwing)
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);

      if (err instanceof Error) {
        if (err.message.includes('cancelled')) {
          setError('Authentication was cancelled');
        } else if (err.message.includes('timeout')) {
          setError('Authentication timed out. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to authenticate');
      }

      if (newRetryCount >= maxRetries) {
        setError(
          `Maximum attempts reached. Please use your password instead.`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-trigger on mount
  useEffect(() => {
    if (autoTrigger && !hasTriggered.current && !unlocked) {
      hasTriggered.current = true;
      attemptUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger, unlocked]);

  const canRetry = retryCount < maxRetries && !unlocked;

  return (
    <Card className="shadow-xl border-border/50">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
          {icon}
        </div>
        <CardTitle className="text-xl">Unlock with {biometricName}</CardTitle>
        <CardDescription>
          {isLoading
            ? `Waiting for ${platformName || biometricName}...`
            : `Use ${platformName || biometricName} to unlock`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {canRetry && !isLoading && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {retryCount > 0 && `Attempt ${retryCount + 1} of ${maxRetries}`}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {canRetry && (
          <Button
            onClick={attemptUnlock}
            disabled={isLoading}
            className="w-full h-11"
          >
            {isLoading ? 'Authenticating...' : 'Try Again'}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={onSwitchToPassword}
          disabled={false}
          className="w-full"
        >
          Use Password Instead
        </Button>
      </CardFooter>
    </Card>
  );
}
