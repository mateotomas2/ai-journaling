import { useState } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Shield,
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getBiometricName } from '@/services/biometric';

export function SecuritySection() {
  const {
    biometricAvailable,
    biometricEnabled,
    biometricSupport,
    setupBiometric,
    disableBiometric,
    isLoading,
    error: contextError,
  } = useDatabase();
  const { showToast } = useToast();

  const [showEnableForm, setShowEnableForm] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const biometricType = biometricSupport?.type || 'unknown';
  const biometricName = getBiometricName(biometricType);
  const icon =
    biometricType === 'face' ? (
      <ShieldCheck className="w-4 h-4" />
    ) : (
      <Fingerprint className="w-4 h-4" />
    );

  const handleEnableBiometric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLocalLoading(true);
    try {
      const success = await setupBiometric(password);
      if (success) {
        showToast(`${biometricName} enabled successfully`, 'success');
        setShowEnableForm(false);
        setPassword('');
      } else {
        // Use context error if available, otherwise generic message
        showToast(contextError || 'Failed to enable biometric', 'error');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to enable biometric';
      showToast(message, 'error');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDisableBiometric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLocalLoading(true);
    try {
      const success = await disableBiometric(password);
      if (success) {
        showToast(`${biometricName} disabled successfully`, 'success');
        setShowDisableForm(false);
        setPassword('');
      } else {
        showToast('Failed to disable biometric', 'error');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to disable biometric';
      showToast(message, 'error');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleCancelEnable = () => {
    setShowEnableForm(false);
    setPassword('');
  };

  const handleCancelDisable = () => {
    setShowDisableForm(false);
    setPassword('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <CardTitle>Security</CardTitle>
        </div>
        <CardDescription>
          Manage your journal security and authentication methods.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Password Protection */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold border-b pb-2">
            Password Protection
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">
              Your journal is protected with password encryption
            </span>
          </div>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Password recovery is not available. Keep your password safe - if
              you lose it, your journal data will be permanently inaccessible.
            </AlertDescription>
          </Alert>
        </div>

        {/* Biometric Unlock */}
        <div className="space-y-3 pt-4">
          <h3 className="text-lg font-semibold border-b pb-2">
            Biometric Unlock
          </h3>

          {!biometricAvailable ? (
            <div className="p-4 bg-muted rounded-md border">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Not Available</p>
                  <p>
                    Biometric authentication is not supported on this device or
                    browser. You may need a device with a fingerprint reader,
                    Face ID, or Windows Hello.
                  </p>
                </div>
              </div>
            </div>
          ) : biometricEnabled ? (
            <div className="space-y-3">
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-md">
                <div className="flex items-center gap-2 mb-3">
                  {icon}
                  <span className="font-medium text-green-700 dark:text-green-400">
                    {biometricName} Enabled
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1 mb-3">
                  <p>
                    <strong>Device:</strong>{' '}
                    {biometricSupport?.platformName || biometricName}
                  </p>
                </div>
                <Alert className="mb-3">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    You can unlock your journal with either {biometricName} or
                    your password. Your password is always available as a
                    backup method.
                  </AlertDescription>
                </Alert>

                {showDisableForm ? (
                  <form
                    onSubmit={handleDisableBiometric}
                    className="space-y-3 p-4 bg-background rounded-md border"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="disable-password">
                        Enter your password to disable {biometricName}
                      </Label>
                      <Input
                        id="disable-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        disabled={localLoading || isLoading}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={localLoading || isLoading || !password.trim()}
                      >
                        {localLoading ? 'Disabling...' : 'Disable Biometric'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelDisable}
                        disabled={localLoading || isLoading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowDisableForm(true)}
                    disabled={isLoading}
                  >
                    Disable {biometricName}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-md border">
                <p className="text-sm text-muted-foreground mb-4">
                  Enable {biometricSupport?.platformName || biometricName} to
                  unlock your journal faster without typing your password each
                  time. Your password will still work and is needed for
                  recovery.
                </p>

                {showEnableForm ? (
                  <form
                    onSubmit={handleEnableBiometric}
                    className="space-y-3 p-4 bg-background rounded-md border"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="enable-password">
                        Enter your password to enable {biometricName}
                      </Label>
                      <Input
                        id="enable-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        disabled={localLoading || isLoading}
                        autoFocus
                      />
                    </div>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Important</AlertTitle>
                      <AlertDescription>
                        After enabling biometric unlock, you'll be prompted to
                        authenticate with your device's biometric sensor. Make
                        sure it's ready.
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={localLoading || isLoading || !password.trim()}
                      >
                        {icon}
                        <span className="ml-2">
                          {localLoading
                            ? 'Enabling...'
                            : `Enable ${biometricName}`}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEnable}
                        disabled={localLoading || isLoading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    onClick={() => setShowEnableForm(true)}
                    disabled={isLoading}
                  >
                    {icon}
                    <span className="ml-2">Enable {biometricName}</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
