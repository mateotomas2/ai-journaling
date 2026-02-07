/**
 * Data management service for export/import and data clearing
 */

import { downloadExport } from '@/services/db/export';
import { importFromFile, type ImportResult } from '@/services/db/import';
import { getDatabase, closeDatabase } from '@/db';

/**
 * Export all journal data to a JSON file
 */
export async function exportAllData(): Promise<void> {
  await downloadExport();
}

/**
 * Import journal data from a file
 */
export async function importData(file: File): Promise<ImportResult> {
  return await importFromFile(file);
}

/**
 * Clear all data from the database
 * Removes all days, messages, summaries, and resets settings
 */
export async function clearAllData(): Promise<void> {
  const db = await getDatabase();

  if (!db) {
    throw new Error('Database not initialized');
  }

  // Remove all documents from all collections
  await Promise.all([
    db.days.find().remove(),
    db.messages.find().remove(),
    db.summaries.find().remove(),
  ]);

  // Reset settings to initial state (don't delete, just clear values)
  const settings = await db.settings.findOne('settings').exec();
  if (settings) {
    await settings.incrementalPatch({
      openRouterApiKey: '',
      systemPrompt: '',
      setupComplete: false,
    });
  }

  // Close database
  await closeDatabase();

  // Clear any remaining localStorage entries
  localStorage.clear();

  // Reload the page to reinitialize
  window.location.href = '/';
}

/**
 * Forcefully clear all data without requiring database authentication.
 * This deletes IndexedDB databases directly and clears localStorage.
 * Used for forgot password flow where user cannot unlock the database.
 */
export async function forceDeleteAllData(): Promise<void> {
  // Close database if it happens to be open
  try {
    await closeDatabase();
  } catch {
    // Ignore errors - database may not be open
  }

  // Delete IndexedDB databases directly
  // RxDB with Dexie creates databases with the name pattern: rxdb-dexie-<dbname>-<collection>
  const databasesToDelete = [
    'journaldb', // Main database name
    'rxdb-dexie-journaldb-settings',
    'rxdb-dexie-journaldb-days',
    'rxdb-dexie-journaldb-messages',
    'rxdb-dexie-journaldb-summaries',
    'rxdb-dexie-journaldb-notes',
    'rxdb-dexie-journaldb-embeddings',
  ];

  // Get all IndexedDB database names and delete any that match our patterns
  if ('databases' in indexedDB) {
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && (db.name.includes('journaldb') || db.name.includes('rxdb'))) {
          databasesToDelete.push(db.name);
        }
      }
    } catch {
      // databases() may not be supported in all browsers
    }
  }

  // Delete all identified databases
  const deletePromises = [...new Set(databasesToDelete)].map(
    (dbName) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Resolve anyway to continue cleanup
        request.onblocked = () => resolve(); // Resolve if blocked
      })
  );

  await Promise.all(deletePromises);

  // Clear all localStorage
  localStorage.clear();

  // Clear all sessionStorage
  sessionStorage.clear();

  // Reload the page to reinitialize
  window.location.href = '/';
}
