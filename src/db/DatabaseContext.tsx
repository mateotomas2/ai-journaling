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
  deriveWrappingKey,
  wrapKey,
  unwrapKey,
  generateIV,
  generateWrappingSalt,
  bytesToBase64,
  base64ToBytes,
} from '@/services/crypto';
import {
  registerBiometric,
  authenticateBiometric,
  checkBiometricSupport,
  isPrfSupported,
  storeEncryptedKey,
  retrieveEncryptedKey,
  deleteEncryptedKey,
  BiometricErrorCode,
  type BiometricSupport,
} from '@/services/biometric';

const SALT_STORAGE_KEY = 'reflekt_salt';
const BIOMETRIC_ENABLED_KEY = 'reflekt_biometric_enabled';
const BIOMETRIC_CREDENTIAL_ID_KEY = 'reflekt_biometric_credential_id';

interface DatabaseContextValue {
  db: JournalDatabase | null;
  isUnlocked: boolean;
  isLoading: boolean;
  isFirstTime: boolean;
  error: string | null;
  setupPassword: (password: string) => Promise<boolean>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => Promise<void>;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricSupport: BiometricSupport | null;
  setupBiometric: (password: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  disableBiometric: (password: string) => Promise<boolean>;
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
  const [biometricSupport, setBiometricSupport] =
    useState<BiometricSupport | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Single initialization effect - ensures biometric support is checked before showing UI
  // This prevents a race condition where isLoading=false was set before biometricSupport was populated
  useEffect(() => {
    async function initialize() {
      // Check biometric support (async) - MUST complete before showing UI
      // Without this, biometricSupport is null when UnlockPage evaluates whether to show biometric UI
      const support = await checkBiometricSupport();
      const prfOk = await isPrfSupported();
      // Biometric is only available if PRF extension is supported
      // Without PRF, WebAuthn signatures are non-deterministic and unlock won't work
      setBiometricSupport({
        ...support,
        isAvailable: support.isAvailable && prfOk,
      });

      // Check localStorage (sync)
      const salt = localStorage.getItem(SALT_STORAGE_KEY);
      setIsFirstTime(!salt);

      const enabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
      setBiometricEnabled(enabled);

      // NOW it's safe to show the UI - biometricSupport is guaranteed to be set
      setIsLoading(false);
    }
    initialize();
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

  // Setup biometric authentication after password is set
  const setupBiometric = useCallback(
    async (password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // Verify password works and get encryption key
        const saltBase64 = localStorage.getItem(SALT_STORAGE_KEY);
        if (!saltBase64) {
          setError('Password must be set up first');
          return false;
        }

        const salt = base64ToSalt(saltBase64);
        const encryptionKey = await deriveKey(password, salt);

        // Register WebAuthn credential
        const { credentialId } = await registerBiometric();

        // Generate PRF salt (stored and used for deterministic secret derivation)
        const prfSalt = crypto.getRandomValues(new Uint8Array(32));

        // Authenticate with PRF to get deterministic secret for key wrapping
        const { prfOutput } = await authenticateBiometric(credentialId, prfSalt);

        if (!prfOutput) {
          setError(
            'PRF extension not supported by this browser. Biometric unlock requires a compatible browser.'
          );
          return false;
        }

        // Derive wrapping key from PRF output (deterministic!)
        const wrappingSalt = generateWrappingSalt();
        const wrappingKey = await deriveWrappingKey(prfOutput, wrappingSalt);

        // Wrap (encrypt) the encryption key
        const iv = generateIV();
        const wrappedKey = await wrapKey(encryptionKey, wrappingKey, iv);

        // Store wrapped key in keystore (including PRF salt for unlock)
        await storeEncryptedKey(
          credentialId,
          bytesToBase64(wrappedKey),
          bytesToBase64(wrappingSalt),
          bytesToBase64(iv),
          bytesToBase64(prfSalt)
        );

        // Save flags
        localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        localStorage.setItem(BIOMETRIC_CREDENTIAL_ID_KEY, credentialId);
        setBiometricEnabled(true);

        return true;
      } catch (err) {
        let message = 'Failed to setup biometric';

        if (err instanceof Error) {
          // Check for specific biometric error codes
          if ('code' in err) {
            const code = (err as { code: BiometricErrorCode }).code;
            if (code === BiometricErrorCode.USER_CANCELLED) {
              message = 'Biometric setup was cancelled';
            } else if (code === BiometricErrorCode.NOT_SUPPORTED) {
              message = 'Biometric authentication is not supported';
            } else if (code === BiometricErrorCode.TIMEOUT) {
              message = 'Biometric setup timed out';
            } else {
              message = err.message;
            }
          } else {
            message = err.message;
          }
        }

        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Unlock database using biometric
  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get credential ID
      const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_ID_KEY);
      if (!credentialId) {
        setError('Biometric not set up');
        return false;
      }

      // Retrieve wrapped key from keystore (need PRF salt first)
      const storedKey = await retrieveEncryptedKey();
      if (!storedKey) {
        setError('Biometric key not found');
        return false;
      }

      // Get the stored PRF salt
      const prfSalt = base64ToBytes(storedKey.prfSalt);

      // Authenticate with PRF using the same salt - produces the same deterministic output
      const { prfOutput } = await authenticateBiometric(
        credentialId,
        prfSalt
      );

      if (!prfOutput) {
        setError('PRF extension not available. Please use password to unlock.');
        return false;
      }

      // Derive wrapping key from PRF output (deterministic, same as during setup)
      const wrappingSalt = base64ToBytes(storedKey.salt);
      const wrappingKey = await deriveWrappingKey(prfOutput, wrappingSalt);

      // Unwrap (decrypt) the encryption key
      const wrappedKeyBytes = base64ToBytes(storedKey.wrappedKey);
      const iv = base64ToBytes(storedKey.iv);
      const encryptionKey = await unwrapKey(
        wrappedKeyBytes.buffer as ArrayBuffer,
        wrappingKey,
        iv
      );

      // Export key as hex for RxDB
      const keyHex = await exportKeyAsHex(encryptionKey);

      // Try to initialize database
      const database = await createDatabase(keyHex);
      setDb(database);
      return true;
    } catch (err) {
      let message = 'Failed to unlock with biometric';

      if (err instanceof Error) {
        // Check for specific biometric error codes
        if ('code' in err) {
          const code = (err as { code: BiometricErrorCode }).code;
          if (code === BiometricErrorCode.USER_CANCELLED) {
            message = 'Biometric authentication was cancelled';
          } else if (code === BiometricErrorCode.TIMEOUT) {
            message = 'Biometric authentication timed out';
          } else if (code === BiometricErrorCode.AUTHENTICATION_FAILED) {
            message = 'Biometric authentication failed';
          } else {
            message = err.message;
          }
        } else {
          message = err.message;
        }
      }

      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disable biometric authentication
  const disableBiometric = useCallback(
    async (password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // Verify password is correct
        const saltBase64 = localStorage.getItem(SALT_STORAGE_KEY);
        if (!saltBase64) {
          setError('No password has been set up');
          return false;
        }

        const salt = base64ToSalt(saltBase64);
        await deriveKey(password, salt); // Will throw if password is wrong

        // Delete keystore
        await deleteEncryptedKey();

        // Clear flags
        localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
        localStorage.removeItem(BIOMETRIC_CREDENTIAL_ID_KEY);
        setBiometricEnabled(false);

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to disable biometric';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const value: DatabaseContextValue = {
    db,
    isUnlocked: db !== null,
    isLoading,
    isFirstTime,
    error,
    setupPassword,
    unlock,
    lock,
    biometricAvailable: biometricSupport?.isAvailable || false,
    biometricEnabled,
    biometricSupport,
    setupBiometric,
    unlockWithBiometric,
    disableBiometric,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}
