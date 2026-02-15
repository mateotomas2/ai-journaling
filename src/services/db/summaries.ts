import { getDatabase } from './database';
import { markDayHasSummary } from './days';
import type { Summary, SummarySections } from '@/types';

/**
 * Save a summary for a day
 */
export async function saveSummary(
  dayId: string,
  sections: SummarySections,
  rawContent: string
): Promise<Summary> {
  const db = getDatabase();

  const summary: Summary = {
    id: dayId, // Same as dayId for 1:1 relationship
    dayId,
    generatedAt: Date.now(),
    deletedAt: 0,
    sections,
    rawContent,
  };

  const doc = await db.summaries.upsert(summary);

  // Mark the day as having a summary
  await markDayHasSummary(dayId);

  return doc.toJSON();
}

/**
 * Get summary for a specific day
 */
export async function getSummaryForDay(dayId: string): Promise<Summary | null> {
  const db = getDatabase();
  const doc = await db.summaries.findOne({ selector: { id: dayId, deletedAt: 0 } }).exec();
  return doc ? doc.toJSON() : null;
}

/**
 * Get summaries for a date range
 */
export async function getSummariesInRange(
  startDate: string,
  endDate: string
): Promise<Summary[]> {
  const db = getDatabase();
  const docs = await db.summaries
    .find({
      selector: {
        dayId: {
          $gte: startDate,
          $lte: endDate,
        },
        deletedAt: 0,
      },
    })
    .sort({ dayId: 'desc' })
    .exec();
  return docs.map((doc) => doc.toJSON());
}

/**
 * Get the N most recent summaries
 */
export async function getRecentSummaries(limit: number): Promise<Summary[]> {
  const db = getDatabase();
  const docs = await db.summaries
    .find({ selector: { deletedAt: 0 } })
    .sort({ generatedAt: 'desc' })
    .limit(limit)
    .exec();
  return docs.map((doc) => doc.toJSON());
}

/**
 * Check if a day has a summary
 */
export async function hasSummary(dayId: string): Promise<boolean> {
  const summary = await getSummaryForDay(dayId);
  return summary !== null;
}

/**
 * Delete a summary (for regeneration)
 */
export async function deleteSummary(dayId: string): Promise<boolean> {
  const db = getDatabase();
  const doc = await db.summaries.findOne(dayId).exec();
  if (doc) {
    await doc.patch({ deletedAt: Date.now() });
    return true;
  }
  return false;
}
