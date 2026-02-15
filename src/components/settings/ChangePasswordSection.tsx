import { useState } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordSection() {
  const { changePassword, isLoading, biometricEnabled } = useDatabase();
  const { showToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setShowForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!currentPassword.trim()) {
      setValidationError('Current password is required');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setValidationError('New password must be different from current password');
      return;
    }

    setLocalLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result === true) {
        showToast('Password changed successfully', 'success');
        resetForm();
      } else {
        setValidationError(result);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to change password';
      setValidationError(message);
    } finally {
      setLocalLoading(false);
    }
  };

  const loading = localLoading || isLoading;

  if (!showForm) {
    return (
      <Button
        variant="outline"
        onClick={() => setShowForm(true)}
        disabled={isLoading}
      >
        <KeyRound className="w-4 h-4 mr-2" />
        Change Password
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 bg-background rounded-md border"
    >
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          Changing your password will re-encrypt all journal data. Do not close
          the app during this process.
          {biometricEnabled && (
            <> Biometric unlock will be disabled and must be re-enabled afterwards.</>
          )}
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
          disabled={loading}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          disabled={loading}
        />
      </div>

      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Re-encrypting...
            </>
          ) : (
            'Change Password'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={resetForm}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
