import type { JournalDatabase } from '../index';
import type { Summary, Note } from '@/types';

/**
 * Migration flag key in localStorage
 */
const MIGRATION_FLAG_KEY = 'migration_summary_to_notes_completed';

/**
 * Check if migration has already been run
 */
export function isMigrationCompleted(): boolean {
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
}

/**
 * Mark migration as completed
 */
function markMigrationCompleted(): void {
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

/**
 * Generate a UUID for note IDs
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Migrate all existing summaries to notes
 * This is idempotent - can be run multiple times safely
 */
export async function migrateSummariesToNotes(
  db: JournalDatabase
): Promise<{ migrated: number; skipped: number; errors: number }> {
  // Check if migration already completed
  if (isMigrationCompleted()) {
    console.log('Summary to notes migration already completed, skipping...');
    return { migrated: 0, skipped: 0, errors: 0 };
  }

  console.log('Starting summary to notes migration...');

  const stats = {
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Get all existing summaries
    const summaryDocs = await db.summaries.find().exec();

    for (const summaryDoc of summaryDocs) {
      const summary: Summary = summaryDoc.toJSON();

      try {
        // Check if note already exists for this day
        const existingNote = await db.notes
          .findOne({
            selector: {
              dayId: summary.dayId,
              category: 'summary',
            },
          })
          .exec();

        if (existingNote) {
          stats.skipped++;
          continue;
        }

        // Create new note from summary (summaries don't have titles)
        const note: Note = {
          id: generateUUID(),
          dayId: summary.dayId,
          category: 'summary',
          content: summary.rawContent,
          createdAt: summary.generatedAt,
          updatedAt: summary.generatedAt,
          deletedAt: 0,
        };

        await db.notes.insert(note);
        stats.migrated++;

        console.log(`Migrated summary for day ${summary.dayId}`);
      } catch (error) {
        console.error(
          `Error migrating summary for day ${summary.dayId}:`,
          error
        );
        stats.errors++;
      }
    }

    // Mark migration as completed
    markMigrationCompleted();

    console.log(
      `Migration completed: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`
    );
  } catch (error) {
    console.error('Fatal error during migration:', error);
    throw error;
  }

  return stats;
}

/**
 * Reset migration flag (for testing purposes)
 */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
}
