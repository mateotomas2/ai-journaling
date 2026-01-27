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
  setupBiometric: (password: string) => Promise<true | string>;
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
      // PRF is no longer required - we use stored wrapping key approach instead
      setBiometricSupport(support);

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
  // Returns true on success, or error message string on failure
  // Uses stored wrapping key approach (no PRF required)
  const setupBiometric = useCallback(
    async (password: string): Promise<true | string> => {
      setIsLoading(true);
      setError(null);

      try {
        // Verify password works and get encryption key
        const saltBase64 = localStorage.getItem(SALT_STORAGE_KEY);
        if (!saltBase64) {
          const msg = 'Password must be set up first';
          setError(msg);
          return msg;
        }

        const salt = base64ToSalt(saltBase64);
        const encryptionKey = await deriveKey(password, salt);

        // Register WebAuthn credential (single fingerprint prompt)
        const { credentialId } = await registerBiometric();

        // Generate random wrapping key (32 bytes) - this will be stored, not derived from PRF
        const wrappingKeyBytes = crypto.getRandomValues(new Uint8Array(32));
        const wrappingKey = await crypto.subtle.importKey(
          'raw',
          wrappingKeyBytes.buffer as ArrayBuffer,
          { name: 'AES-GCM', length: 256 },
          true,
          ['wrapKey', 'unwrapKey']
        );

        // Wrap (encrypt) the encryption key with the wrapping key
        const iv = generateIV();
        const wrappedKey = await wrapKey(encryptionKey, wrappingKey, iv);

        // Export wrapping key to store it
        const exportedWrappingKey = await crypto.subtle.exportKey(
          'raw',
          wrappingKey
        );

        // Store wrapped key and wrapping key in keystore
        // The wrapping key is stored directly (biometric gates access, not derivation)
        const wrappingSalt = generateWrappingSalt(); // Keep for potential future use
        await storeEncryptedKey(
          credentialId,
          bytesToBase64(wrappedKey),
          bytesToBase64(new Uint8Array(exportedWrappingKey)),
          bytesToBase64(wrappingSalt),
          bytesToBase64(iv)
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
        return message;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Unlock database using biometric
  // Uses stored wrapping key approach (no PRF required)
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

      // Retrieve stored key data from keystore
      const storedKey = await retrieveEncryptedKey();
      if (!storedKey) {
        setError('Biometric key not found');
        return false;
      }

      // Authenticate with WebAuthn (single fingerprint prompt, no PRF)
      // This verifies the user is authorized to access the stored key
      await authenticateBiometric(credentialId);

      // Import the stored wrapping key
      const wrappingKeyBytes = base64ToBytes(storedKey.wrappingKey);
      const wrappingKey = await crypto.subtle.importKey(
        'raw',
        wrappingKeyBytes.buffer as ArrayBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['unwrapKey']
      );

      // Unwrap (decrypt) the encryption key using the stored wrapping key
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
