import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateStorageFactory } from 'rxdb/plugins/core';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { settingsSchema } from '../services/db/schemas';
import { daySchema } from './schemas/day.schema';
import { messageSchema } from './schemas/message.schema';
import { summarySchema } from './schemas/summary.schema';
import type { Settings } from '../types';
import type { Day, Message, Summary } from '../types/entities';

// Add dev mode plugin in development
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
}

// Custom AJV validator with strict mode disabled
let ajv: Ajv | undefined;
function getAjv() {
  if (!ajv) {
    ajv = new Ajv({
      strict: false, // Disable strict mode to prevent issues with RxDB's custom keywords
    });
    // Add RxDB's custom keywords
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
  }
  return ajv;
}

function getValidator(schema: any) {
  const validator = getAjv().compile(schema);
  return (docData: any) => {
    const isValid = validator(docData);
    if (isValid) {
      return [];
    } else {
      // Convert AJV errors to RxDB's expected format
      return (validator.errors || []).map(error => ({
        field: error.instancePath || error.schemaPath || '',
        message: error.message || '',
      }));
    }
  };
}

const wrappedValidateAjvStorage = wrappedValidateStorageFactory(getValidator, 'ajv');

export type JournalCollections = {
  settings: RxCollection<Settings>;
  days: RxCollection<Day>;
  messages: RxCollection<Message>;
  summaries: RxCollection<Summary>;
};

export type JournalDatabase = RxDatabase<JournalCollections>;

let dbInstance: JournalDatabase | null = null;

export async function createDatabase(passphrase: string): Promise<JournalDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  // Build storage chain: Dexie → Validator (for dev mode) → Encryption
  const baseStorage = getRxStorageDexie();
  const validatedStorage = wrappedValidateAjvStorage({ storage: baseStorage });
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
