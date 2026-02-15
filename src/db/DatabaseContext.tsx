import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useVisibilityChange } from '@/hooks/useVisibilityChange';
import { createDatabase, closeDatabase, setSyncKey, type JournalDatabase } from './index';
import {
  generateSalt,
  deriveKey,
  deriveSyncKey,
  exportKeyAsHex,
  saltToBase64,
  base64ToSalt,
  wrapKey,
  unwrapKey,
  generateIV,
  generateWrappingSalt,
  bytesToBase64,
  base64ToBytes,
  CURRENT_ITERATIONS,
  LEGACY_ITERATIONS,
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
import type { Settings } from '@/types';
import type { Day, Message, Summary, Note, Embedding } from '@/types/entities';

const SALT_STORAGE_KEY = 'reflekt_salt';
const ITERATIONS_STORAGE_KEY = 'reflekt_iterations';
const BIOMETRIC_ENABLED_KEY = 'reflekt_biometric_enabled';
const BIOMETRIC_CREDENTIAL_ID_KEY = 'reflekt_biometric_credential_id';

/**
 * Get the PBKDF2 iteration count for key derivation.
 * Returns stored value for existing users, or current standard for new users.
 */
function getIterations(): number {
  const stored = localStorage.getItem(ITERATIONS_STORAGE_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  // Legacy users don't have iterations stored - use old value for compatibility
  const hasSalt = localStorage.getItem(SALT_STORAGE_KEY);
  if (hasSalt) {
    return LEGACY_ITERATIONS;
  }
  // New users get current standard
  return CURRENT_ITERATIONS;
}

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
  changePassword: (oldPassword: string, newPassword: string) => Promise<true | string>;
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

  // Auto-lock database when app is backgrounded (privacy: hides content on resume)
  useVisibilityChange({
    onHidden: () => {
      if (db) lock();
    },
  });

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

        // Store iteration count for future migrations
        localStorage.setItem(ITERATIONS_STORAGE_KEY, String(CURRENT_ITERATIONS));

        // Derive encryption key from password with current iteration count
        const key = await deriveKey(password, salt, CURRENT_ITERATIONS);
        const keyHex = await exportKeyAsHex(key);

        // Derive and store sync key (deterministic, for cross-device sync)
        const syncKey = await deriveSyncKey(password);
        setSyncKey(syncKey);

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

      // Get iteration count (legacy or current)
      const iterations = getIterations();

      // Derive key from password with appropriate iteration count
      const key = await deriveKey(password, salt, iterations);
      const keyHex = await exportKeyAsHex(key);

      // Derive and store sync key (deterministic, for cross-device sync)
      const syncKey = await deriveSyncKey(password);
      setSyncKey(syncKey);

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
        const iterations = getIterations();
        const encryptionKey = await deriveKey(password, salt, iterations);

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

        // Derive and wrap the sync key too, so biometric unlock can restore it
        const syncKey = await deriveSyncKey(password);
        const syncIv = generateIV();
        const wrappedSyncKey = await wrapKey(syncKey, wrappingKey, syncIv);

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
          bytesToBase64(iv),
          bytesToBase64(wrappedSyncKey),
          bytesToBase64(syncIv)
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

      // Unwrap sync key if available (not present for legacy biometric setups)
      if (storedKey.wrappedSyncKey && storedKey.syncIv) {
        const wrappedSyncKeyBytes = base64ToBytes(storedKey.wrappedSyncKey);
        const syncIv = base64ToBytes(storedKey.syncIv);
        const syncKey = await unwrapKey(
          wrappedSyncKeyBytes.buffer as ArrayBuffer,
          wrappingKey,
          syncIv
        );
        setSyncKey(syncKey);
      }

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
        const iterations = getIterations();
        await deriveKey(password, salt, iterations); // Will throw if password is wrong

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

  // Change password: export all data, delete DB, recreate with new key, re-import
  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<true | string> => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Verify old password
        const saltBase64 = localStorage.getItem(SALT_STORAGE_KEY);
        if (!saltBase64) {
          return 'No password has been set up';
        }
        const oldSalt = base64ToSalt(saltBase64);
        const iterations = getIterations();

        // Derive key to verify old password (will be used implicitly via existing db)
        const oldKey = await deriveKey(oldPassword, oldSalt, iterations);
        const oldKeyHex = await exportKeyAsHex(oldKey);

        // 2. Verify old password is correct by trying to open db
        // If db is already open, verify the key matches by re-deriving
        if (!db) {
          try {
            const testDb = await createDatabase(oldKeyHex);
            // If we got here, password is correct. Close it so we can proceed.
            await testDb.close();
          } catch {
            return 'Current password is incorrect';
          }
        }

        // 3. Export all data from all collections
        const currentDb = db;
        if (!currentDb) {
          return 'Database is not unlocked';
        }

        const [settingsResult, daysResult, messagesResult, summariesResult, notesResult, embeddingsResult] =
          await Promise.all([
            currentDb.settings.find().exec(),
            currentDb.days.find().exec(),
            currentDb.messages.find().exec(),
            currentDb.summaries.find().exec(),
            currentDb.notes.find().exec(),
            currentDb.embeddings.find().exec(),
          ]);

        const exportedData = {
          settings: settingsResult.map((doc) => doc.toJSON() as Settings),
          days: daysResult.map((doc) => doc.toJSON() as Day),
          messages: messagesResult.map((doc) => doc.toJSON() as Message),
          summaries: summariesResult.map((doc) => doc.toJSON() as Summary),
          notes: notesResult.map((doc) => doc.toJSON() as Note),
          embeddings: embeddingsResult.map((doc) => doc.toJSON() as Embedding),
        };

        // 4. Close database
        await closeDatabase();
        setDb(null);

        // 5. Delete all IndexedDB databases
        const databasesToDelete = new Set([
          'journaldb',
          'rxdb-dexie-journaldb-settings',
          'rxdb-dexie-journaldb-days',
          'rxdb-dexie-journaldb-messages',
          'rxdb-dexie-journaldb-summaries',
          'rxdb-dexie-journaldb-notes',
          'rxdb-dexie-journaldb-embeddings',
        ]);

        if ('databases' in indexedDB) {
          try {
            const databases = await indexedDB.databases();
            for (const idb of databases) {
              if (idb.name && (idb.name.includes('journaldb') || idb.name.includes('rxdb'))) {
                databasesToDelete.add(idb.name);
              }
            }
          } catch {
            // databases() may not be supported in all browsers
          }
        }

        await Promise.all(
          [...databasesToDelete].map(
            (dbName) =>
              new Promise<void>((resolve) => {
                const request = indexedDB.deleteDatabase(dbName);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
              })
          )
        );

        // 6. Generate new salt and derive new key
        const newSalt = generateSalt();
        localStorage.setItem(SALT_STORAGE_KEY, saltToBase64(newSalt));
        localStorage.setItem(ITERATIONS_STORAGE_KEY, String(CURRENT_ITERATIONS));

        const newKey = await deriveKey(newPassword, newSalt, CURRENT_ITERATIONS);
        const newKeyHex = await exportKeyAsHex(newKey);

        // 7. Derive and store new sync key
        const syncKey = await deriveSyncKey(newPassword);
        setSyncKey(syncKey);

        // 8. Create new database with new key
        const newDb = await createDatabase(newKeyHex);

        // 9. Re-import all data
        // Settings: upsert (createDatabase already creates a default settings doc)
        for (const setting of exportedData.settings) {
          await newDb.settings.upsert(setting);
        }
        if (exportedData.days.length > 0) {
          await newDb.days.bulkInsert(exportedData.days);
        }
        if (exportedData.messages.length > 0) {
          await newDb.messages.bulkInsert(exportedData.messages);
        }
        if (exportedData.summaries.length > 0) {
          await newDb.summaries.bulkInsert(exportedData.summaries);
        }
        if (exportedData.notes.length > 0) {
          await newDb.notes.bulkInsert(exportedData.notes);
        }
        if (exportedData.embeddings.length > 0) {
          await newDb.embeddings.bulkInsert(exportedData.embeddings);
        }

        // 10. Disable biometric (user must re-enable with new password)
        if (biometricEnabled) {
          try {
            await deleteEncryptedKey();
          } catch {
            // Ignore - key may not exist
          }
          localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
          localStorage.removeItem(BIOMETRIC_CREDENTIAL_ID_KEY);
          setBiometricEnabled(false);
        }

        setDb(newDb);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to change password';
        setError(message);
        return message;
      } finally {
        setIsLoading(false);
      }
    },
    [db, biometricEnabled]
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
    changePassword,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}
