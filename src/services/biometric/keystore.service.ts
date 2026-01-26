/**
 * Keystore service for storing encrypted encryption keys
 * Uses IndexedDB to store wrapped (encrypted) keys
 */

import { StoredBiometricKey, BiometricError, BiometricErrorCode } from './types';

const DB_NAME = 'reflekt_biometric_store';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_ID = 'biometric_key'; // Single key for single-user app

/**
 * Open the keystore database
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(
        new BiometricError(
          'Failed to open keystore database',
          BiometricErrorCode.KEYSTORE_ERROR,
          request.error || undefined
        )
      );
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Store the encrypted encryption key
 */
export async function storeEncryptedKey(
  credentialId: string,
  wrappedKey: string,
  salt: string,
  iv: string
): Promise<void> {
  try {
    const db = await openDatabase();

    const storedKey: StoredBiometricKey & { id: string } = {
      id: KEY_ID,
      credentialId,
      wrappedKey,
      salt,
      iv,
      enrolledAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(storedKey);

      request.onerror = () => {
        reject(
          new BiometricError(
            'Failed to store encrypted key',
            BiometricErrorCode.KEYSTORE_ERROR,
            request.error || undefined
          )
        );
      };

      request.onsuccess = () => {
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    if (error instanceof BiometricError) {
      throw error;
    }
    throw new BiometricError(
      'Failed to store encrypted key',
      BiometricErrorCode.KEYSTORE_ERROR,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieve the encrypted encryption key
 */
export async function retrieveEncryptedKey(): Promise<StoredBiometricKey | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(KEY_ID);

      request.onerror = () => {
        reject(
          new BiometricError(
            'Failed to retrieve encrypted key',
            BiometricErrorCode.KEYSTORE_ERROR,
            request.error || undefined
          )
        );
      };

      request.onsuccess = () => {
        const result = request.result as
          | (StoredBiometricKey & { id: string })
          | undefined;
        if (result) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...storedKey } = result;
          resolve(storedKey);
        } else {
          resolve(null);
        }
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    if (error instanceof BiometricError) {
      throw error;
    }
    throw new BiometricError(
      'Failed to retrieve encrypted key',
      BiometricErrorCode.KEYSTORE_ERROR,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Delete the encrypted encryption key
 */
export async function deleteEncryptedKey(): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(KEY_ID);

      request.onerror = () => {
        reject(
          new BiometricError(
            'Failed to delete encrypted key',
            BiometricErrorCode.KEYSTORE_ERROR,
            request.error || undefined
          )
        );
      };

      request.onsuccess = () => {
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    if (error instanceof BiometricError) {
      throw error;
    }
    throw new BiometricError(
      'Failed to delete encrypted key',
      BiometricErrorCode.KEYSTORE_ERROR,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if a biometric key is stored
 */
export async function hasStoredKey(): Promise<boolean> {
  try {
    const key = await retrieveEncryptedKey();
    return key !== null;
  } catch (error) {
    console.error('Error checking for stored key:', error);
    return false;
  }
}
