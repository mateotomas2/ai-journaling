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
