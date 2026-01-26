import { useState } from 'react';
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

interface BiometricSetupProps {
  biometricType: BiometricType;
  platformName?: string | undefined;
  onEnable: () => Promise<void>;
  onSkip: () => void;
  isLoading?: boolean;
}

export function BiometricSetup({
  biometricType,
  platformName,
  onEnable,
  onSkip,
  isLoading = false,
}: BiometricSetupProps) {
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async () => {
    setError(null);
    try {
      await onEnable();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to enable biometric';
      setError(message);
    }
  };

  const biometricName = getBiometricName(biometricType);
  const icon =
    biometricType === 'face' ? (
      <ShieldCheck className="w-12 h-12 text-primary" />
    ) : (
      <Fingerprint className="w-12 h-12 text-primary" />
    );

  return (
    <Card className="shadow-xl border-border/50">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          {icon}
        </div>
        <CardTitle className="text-xl">Enable {biometricName}?</CardTitle>
        <CardDescription>
          Unlock your journal faster with {platformName || biometricName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="text-center">
            You can use {platformName || biometricName} to unlock your journal
            instead of typing your password each time.
          </p>
          <Alert className="mt-4">
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              Your password will still work and is needed for recovery. You can
              disable biometric unlock anytime in settings.
            </AlertDescription>
          </Alert>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={handleEnable}
          disabled={isLoading}
          className="w-full h-11"
        >
          {isLoading ? 'Setting up...' : `Enable ${biometricName}`}
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          disabled={isLoading}
          className="w-full"
        >
          Skip for Now
        </Button>
      </CardFooter>
    </Card>
  );
}
