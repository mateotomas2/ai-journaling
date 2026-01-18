import { useState, useEffect, useCallback } from 'react';
import {
  generateSalt,
  deriveKey,
  exportKeyAsHex,
  saltToBase64,
  base64ToSalt,
} from '@/services/crypto';
import {
  initDatabase,
  databaseExists,
  closeDatabase,
  saveSettings,
  getSettings,
} from '@/services/db';

const SALT_STORAGE_KEY = 'reflekt_salt';

export interface UseAuthReturn {
  isAuthenticated: boolean;
  isFirstTime: boolean;
  isLoading: boolean;
  error: string | null;
  setupPassword: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if this is first time (no salt exists)
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const salt = localStorage.getItem(SALT_STORAGE_KEY);
        const dbExists = await databaseExists();
        setIsFirstTime(!salt || !dbExists);
      } catch {
        setIsFirstTime(true);
      } finally {
        setIsLoading(false);
      }
    };
    checkFirstTime();
  }, []);

  // Setup password for first time users
  const setupPassword = useCallback(async (password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate and store salt
      const salt = generateSalt();
      localStorage.setItem(SALT_STORAGE_KEY, saltToBase64(salt));

      // Derive encryption key
      const key = await deriveKey(password, salt);
      const keyHex = await exportKeyAsHex(key);

      // Initialize database with encryption
      await initDatabase(keyHex);

      // Create initial settings
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await saveSettings({
        timezone,
        setupComplete: true,
        createdAt: Date.now(),
      });

      setIsFirstTime(false);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup password');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unlock with existing password
  const unlock = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get stored salt
      const saltBase64 = localStorage.getItem(SALT_STORAGE_KEY);
      if (!saltBase64) {
        setError('No password has been set up');
        return false;
      }

      const salt = base64ToSalt(saltBase64);

      // Derive key from password
      const key = await deriveKey(password, salt);
      const keyHex = await exportKeyAsHex(key);

      // Try to initialize database - will fail if password is wrong
      await initDatabase(keyHex);

      // Verify by trying to read settings
      const settings = await getSettings();
      if (!settings) {
        // Database opened but no settings = likely wrong password
        await closeDatabase();
        setError('Invalid password');
        return false;
      }

      setIsAuthenticated(true);
      return true;
    } catch (err) {
      // Most likely wrong password - database decryption failed
      setError('Invalid password');
      await closeDatabase();
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Lock the app (close database, clear auth state)
  const lock = useCallback(() => {
    closeDatabase();
    setIsAuthenticated(false);
    setError(null);
  }, []);

  return {
    isAuthenticated,
    isFirstTime,
    isLoading,
    error,
    setupPassword,
    unlock,
    lock,
  };
}
