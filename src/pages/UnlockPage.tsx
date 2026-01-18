import { useState, type FormEvent } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import './UnlockPage.css';

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
    <div className="unlock-page">
      <div className="unlock-card">
        <h1>Welcome Back</h1>
        <p>Enter your password to unlock your journal.</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !password.trim()}>
            {isLoading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>

        {error && <p className="unlock-error">{error}</p>}
      </div>
    </div>
  );
}
