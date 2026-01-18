import { useState } from 'react';
import { PasswordWarning } from './PasswordWarning';

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
    <div className="password-setup">
      <h1>Welcome to Reflekt</h1>
      <p>Create a password to protect your journal.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password (min 8 characters)"
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            disabled={isLoading}
          />
        </div>

        {(localError || error) && (
          <div className="error-message">{localError || error}</div>
        )}

        <button type="submit" disabled={isLoading || !password || !confirmPassword}>
          {isLoading ? 'Setting up...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
