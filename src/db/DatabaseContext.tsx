import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { createDatabase, closeDatabase, type JournalDatabase } from './index';
import {
  generateSalt,
  deriveKey,
  exportKeyAsHex,
  saltToBase64,
  base64ToSalt,
} from '@/services/crypto';

const SALT_STORAGE_KEY = 'reflekt_salt';

interface DatabaseContextValue {
  db: JournalDatabase | null;
  isUnlocked: boolean;
  isLoading: boolean;
  isFirstTime: boolean;
  error: string | null;
  setupPassword: (password: string) => Promise<boolean>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => Promise<void>;
}

export const DatabaseContext = createContext<DatabaseContextValue | null>(null);

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [db, setDb] = useState<JournalDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if this is first time (no salt exists)
  useEffect(() => {
    const salt = localStorage.getItem(SALT_STORAGE_KEY);
    setIsFirstTime(!salt);
    setIsLoading(false);
  }, []);

  // Setup password for first-time users
  const setupPassword = useCallback(
    async (password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // Generate and store salt
        const salt = generateSalt();
        localStorage.setItem(SALT_STORAGE_KEY, saltToBase64(salt));

        // Derive encryption key from password
        const key = await deriveKey(password, salt);
        const keyHex = await exportKeyAsHex(key);

        // Initialize database with derived key
        const database = await createDatabase(keyHex);
        setDb(database);
        setIsFirstTime(false);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to setup password';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

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
      const database = await createDatabase(keyHex);
      setDb(database);
      return true;
    } catch (err) {
      // Most likely wrong password - database decryption failed
      setError('Invalid password. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const lock = useCallback(async () => {
    await closeDatabase();
    setDb(null);
    setError(null);
  }, []);

  const value: DatabaseContextValue = {
    db,
    isUnlocked: db !== null,
    isLoading,
    isFirstTime,
    error,
    setupPassword,
    unlock,
    lock,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}
