import { useState } from 'react';

interface PasswordUnlockProps {
  onUnlock: (password: string) => Promise<boolean>;
  isLoading?: boolean;
  error?: string | null;
}

export function PasswordUnlock({
  onUnlock,
  isLoading = false,
  error,
}: PasswordUnlockProps) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!password) {
      setLocalError('Please enter your password');
      return;
    }

    const success = await onUnlock(password);
    if (!success) {
      setPassword('');
      setLocalError('Invalid password. Please try again.');
    }
  };

  return (
    <div className="password-unlock">
      <h1>Welcome Back</h1>
      <p>Enter your password to unlock your journal.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={isLoading}
            autoFocus
          />
        </div>

        {(localError || error) && (
          <div className="error-message">{localError || error}</div>
        )}

        <button type="submit" disabled={isLoading || !password}>
          {isLoading ? 'Unlocking...' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
