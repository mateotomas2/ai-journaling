import { useState } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { PasswordSetup } from '@/components/auth';
import { BiometricSetup } from '@/components/auth/BiometricSetup';
import { BookOpen } from 'lucide-react';

export function Setup() {
  const {
    setupPassword,
    setupBiometric,
    isLoading,
    error,
    biometricAvailable,
    biometricSupport,
  } = useDatabase();
  const [passwordSetupComplete, setPasswordSetupComplete] = useState(false);
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [showBiometric, setShowBiometric] = useState(false);

  const handlePasswordSetup = async (password: string) => {
    const success = await setupPassword(password);
    if (success) {
      setCurrentPassword(password);
      setPasswordSetupComplete(true);

      // Show biometric setup if available
      if (biometricAvailable) {
        setShowBiometric(true);
      }
    }
  };

  const handleBiometricEnable = async () => {
    if (!currentPassword) return;
    await setupBiometric(currentPassword);
    // Password will be unlocked after this, App.tsx will route to main app
  };

  const handleBiometricSkip = () => {
    // Password setup is complete, user skipped biometric
    // App.tsx will route to main app since isUnlocked will be true
  };

  // Show biometric setup if password setup is complete and biometric is available
  if (passwordSetupComplete && showBiometric && biometricAvailable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background p-4">
        <div className="w-full max-w-md">
          {/* Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
              <BookOpen className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Daily Journal</h1>
            <p className="text-sm text-muted-foreground">
              Your private space for reflection
            </p>
          </div>

          <BiometricSetup
            biometricType={biometricSupport?.type || 'unknown'}
            platformName={biometricSupport?.platformName}
            onEnable={handleBiometricEnable}
            onSkip={handleBiometricSkip}
            isLoading={isLoading}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <PasswordSetup
          onSetup={handlePasswordSetup}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}
