import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import { wrappedValidatePrecompiledStorage } from './validators';
import { settingsSchema } from '../services/db/schemas';
import { daySchema } from './schemas/day.schema';
import { messageSchema } from './schemas/message.schema';
import { summarySchema } from './schemas/summary.schema';
import { noteSchema } from './schemas/note.schema';
import { embeddingSchema } from './schemas/embedding.schema';
import type { Settings } from '../types';
import type { Day, Message, Summary, Note, Embedding } from '../types/entities';
import { migrateSummariesToNotes } from './migrations/summary-to-notes';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';

// Add this BEFORE you call createRxDatabase
addRxPlugin(RxDBMigrationSchemaPlugin);

// Add dev mode plugin in development
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
}

export type JournalCollections = {
  settings: RxCollection<Settings>;
  days: RxCollection<Day>;
  messages: RxCollection<Message>;
  summaries: RxCollection<Summary>;
  notes: RxCollection<Note>;
  embeddings: RxCollection<Embedding>;
};

export type JournalDatabase = RxDatabase<JournalCollections>;

let dbInstance: JournalDatabase | null = null;
let storedPassphrase: string | null = null;

export async function createDatabase(passphrase: string): Promise<JournalDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  // Store passphrase for sync encryption
  storedPassphrase = passphrase;

  // Build storage chain: Dexie → Validator (for dev mode) → Encryption
  const baseStorage = getRxStorageDexie();
  const validatedStorage = wrappedValidatePrecompiledStorage({ storage: baseStorage });
  const encryptedStorage = wrappedKeyEncryptionCryptoJsStorage({
    storage: validatedStorage,
  });

  const db = await createRxDatabase<JournalCollections>({
    name: 'journaldb',
    storage: encryptedStorage,
    password: passphrase,
    multiInstance: false,
    eventReduce: true,
    closeDuplicates: true, // Auto-close duplicates on hot reload
  });

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
    notes: {
      schema: noteSchema,
    },
    embeddings: {
      schema: embeddingSchema,
      migrationStrategies: {
        // Migration from v0 to v1: Convert messageId to entityType + entityId
        1: (oldDoc: { id: string; messageId: string; vector: number[]; modelVersion: string; createdAt: number }) => ({
          ...oldDoc,
          entityType: 'message' as const,
          entityId: oldDoc.messageId,
        }),
      },
    },
  });

  // Initialize settings document if it doesn't exist
  const existingSettings = await db.settings.findOne('settings').exec();
  if (!existingSettings) {
    await db.settings.insert({
      id: 'settings',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      setupComplete: false,
      createdAt: Date.now(),
    });
  }

  // MIGRATION: Check for legacy localStorage API key
  const legacyApiKey = localStorage.getItem('openrouter_api_key');
  if (legacyApiKey) {
    const settings = await db.settings.findOne('settings').exec();
    if (settings && !settings.openRouterApiKey) {
      // Migrate to database
      await settings.patch({ openRouterApiKey: legacyApiKey });
      // Clean up localStorage
      localStorage.removeItem('openrouter_api_key');
      console.log('Migrated API key from localStorage to database');
    }
  }

  // MIGRATION: Convert old summaries to notes
  try {
    await migrateSummariesToNotes(db);
  } catch (error) {
    console.error('Error running summary to notes migration:', error);
    // Don't fail database initialization if migration fails
  }

  dbInstance = db;
  return db;
}

export async function getDatabase(): Promise<JournalDatabase | null> {
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

export function isDatabaseInitialized(): boolean {
  return dbInstance !== null;
}

export async function getSyncEncryptionKey(): Promise<CryptoKey> {
  if (!storedPassphrase) {
    throw new Error('Database not initialized - no encryption key available');
  }

  const hexBytes = new Uint8Array(
    storedPassphrase.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  return crypto.subtle.importKey(
    'raw',
    hexBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
