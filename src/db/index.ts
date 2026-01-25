import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection, type RxDocumentData, type RxJsonSchema } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateStorageFactory } from 'rxdb';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { settingsSchema } from '../services/db/schemas';
import { daySchema } from './schemas/day.schema';
import { messageSchema } from './schemas/message.schema';
import { summarySchema } from './schemas/summary.schema';
import { embeddingSchema } from './schemas/embedding.schema';
import type { Settings } from '../types';
import type { Day, Message, Summary, Embedding } from '../types/entities';

// Custom AJV validator with strict mode disabled (RxDB's default has strict: true hardcoded)
const ajv = new Ajv({ strict: false });
ajv.addKeyword('version');
ajv.addKeyword('keyCompression');
ajv.addKeyword('primaryKey');
ajv.addKeyword('indexes');
ajv.addKeyword('encrypted');
ajv.addKeyword('final');
ajv.addKeyword('sharding');
ajv.addKeyword('internalIndexes');
ajv.addKeyword('attachments');
ajv.addKeyword('ref');
ajv.addKeyword('crdt');
addFormats(ajv);

function getValidator(schema: RxJsonSchema<unknown>) {
  const validator = ajv.compile(schema);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (docData: RxDocumentData<unknown>): any[] => {
    const isValid = validator(docData);
    return isValid ? [] : (validator.errors ?? []);
  };
}

const wrappedValidateCustomAjvStorage = wrappedValidateStorageFactory(getValidator, 'ajv-custom');

// Add dev mode plugin in development
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
}

export type JournalCollections = {
  settings: RxCollection<Settings>;
  days: RxCollection<Day>;
  messages: RxCollection<Message>;
  summaries: RxCollection<Summary>;
  embeddings: RxCollection<Embedding>;
};

export type JournalDatabase = RxDatabase<JournalCollections>;

let dbInstance: JournalDatabase | null = null;

export async function createDatabase(passphrase: string): Promise<JournalDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  // Build storage chain: Dexie → Validator (for dev mode) → Encryption
  const baseStorage = getRxStorageDexie();
  const validatedStorage = wrappedValidateCustomAjvStorage({ storage: baseStorage });
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
    embeddings: {
      schema: embeddingSchema,
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
