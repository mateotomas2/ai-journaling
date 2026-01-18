import { getDatabase } from './database';
import type { Day } from '@/types';

/**
 * Create a new day entry
 */
export async function createDay(dayId: string, timezone: string): Promise<Day> {
  const db = getDatabase();
  const now = Date.now();
  const doc = await db.days.insert({
    id: dayId,
    createdAt: now,
    updatedAt: now,
    timezone,
    hasSummary: false,
  });
  return doc.toJSON();
}

/**
 * Get a day by ID
 */
export async function getDay(dayId: string): Promise<Day | null> {
  const db = getDatabase();
  const doc = await db.days.findOne(dayId).exec();
  return doc ? doc.toJSON() : null;
}

/**
 * Get or create a day
 */
export async function getOrCreateDay(
  dayId: string,
  timezone: string
): Promise<Day> {
  const existing = await getDay(dayId);
  if (existing) {
    return existing;
  }
  return createDay(dayId, timezone);
}

/**
 * Update a day's updatedAt timestamp
 */
export async function touchDay(dayId: string): Promise<void> {
  const db = getDatabase();
  const doc = await db.days.findOne(dayId).exec();
  if (doc) {
    await doc.patch({ updatedAt: Date.now() });
  }
}

/**
 * Mark a day as having a summary
 */
export async function markDayHasSummary(dayId: string): Promise<void> {
  const db = getDatabase();
  const doc = await db.days.findOne(dayId).exec();
  if (doc) {
    await doc.patch({ hasSummary: true });
  }
}

/**
 * List all days, optionally filtered
 */
export async function listDays(options?: {
  limit?: number;
  hasSummary?: boolean;
}): Promise<Day[]> {
  const db = getDatabase();

  let query = db.days.find();

  if (options?.hasSummary !== undefined) {
    query = query.where('hasSummary').eq(options.hasSummary);
  }

  query = query.sort({ createdAt: 'desc' });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const docs = await query.exec();
  return docs.map((doc) => doc.toJSON());
}

/**
 * Get days in a date range
 */
export async function getDaysInRange(
  startDate: string,
  endDate: string
): Promise<Day[]> {
  const db = getDatabase();
  const docs = await db.days
    .find({
      selector: {
        id: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    })
    .sort({ id: 'asc' })
    .exec();
  return docs.map((doc) => doc.toJSON());
}
