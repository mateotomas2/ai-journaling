import { createRxDatabase, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import { settingsSchema, daySchema, messageSchema, summarySchema } from './schemas';
import type { Settings, Day, Message, Summary } from '@/types';

// Collection types
export type SettingsCollection = RxCollection<Settings>;
export type DaysCollection = RxCollection<Day>;
export type MessagesCollection = RxCollection<Message>;
export type SummariesCollection = RxCollection<Summary>;

// Database type with collections
export type ReflektDatabaseCollections = {
  settings: SettingsCollection;
  days: DaysCollection;
  messages: MessagesCollection;
  summaries: SummariesCollection;
};

export type ReflektDatabase = RxDatabase<ReflektDatabaseCollections>;

// Singleton database instance
let dbInstance: ReflektDatabase | null = null;

/**
 * Initialize the RxDB database with encryption
 * @param encryptionKey - Hex string key derived from user password
 */
export async function initDatabase(encryptionKey: string): Promise<ReflektDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  // Wrap storage with encryption
  const encryptedStorage = wrappedKeyEncryptionCryptoJsStorage({
    storage: getRxStorageDexie(),
  });

  const db = await createRxDatabase<ReflektDatabaseCollections>({
    name: 'reflekt',
    storage: encryptedStorage,
    password: encryptionKey,
  });

  // Add collections
  await db.addCollections({
    settings: {
      schema: settingsSchema,
    },
    days: {
      schema: daySchema,
    },
    messages: {
      schema: messageSchema,
    },
    summaries: {
      schema: summarySchema,
    },
  });

  dbInstance = db;
  return db;
}

/**
 * Get the database instance (must be initialized first)
 */
export function getDatabase(): ReflektDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return dbInstance;
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return dbInstance !== null;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.remove();
    dbInstance = null;
  }
}

/**
 * Check if a database exists (has been created before)
 * Used to determine first-time vs returning user
 */
export async function databaseExists(): Promise<boolean> {
  // Check if IndexedDB has the database
  const databases = await indexedDB.databases();
  return databases.some((db) => db.name === 'reflekt');
}
