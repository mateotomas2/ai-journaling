/**
 * Data Import Service
 * Imports journal data from JSON format
 */

import { z } from 'zod';
import { getDatabase } from '@/db';
import type { Day, Message, Summary } from '@/types';

// Schema for validating import data
const SummarySectionsSchema = z.object({
  journal: z.string(),
  insights: z.string(),
  health: z.string(),
  dreams: z.string(),
});

const ImportDataSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  days: z.array(
    z.object({
      id: z.string(),
      createdAt: z.number(),
      updatedAt: z.number(),
      timezone: z.string(),
      hasSummary: z.boolean(),
    })
  ),
  messages: z.array(
    z.object({
      id: z.string(),
      dayId: z.string(),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      timestamp: z.number(),
      categories: z.array(z.enum(['journal', 'insight', 'health', 'dream'])).optional(),
    })
  ),
  summaries: z.array(
    z.object({
      id: z.string(),
      dayId: z.string(),
      generatedAt: z.number(),
      sections: SummarySectionsSchema,
      rawContent: z.string(),
    })
  ),
});

export type ImportData = z.infer<typeof ImportDataSchema>;

export interface ImportResult {
  success: boolean;
  imported: {
    days: number;
    messages: number;
    summaries: number;
  };
  skipped: {
    days: number;
    messages: number;
    summaries: number;
  };
  errors: string[];
}

/**
 * Validate import data structure
 */
export function validateImportData(data: unknown): ImportData {
  return ImportDataSchema.parse(data);
}

/**
 * Import journal data from JSON
 * Skips existing records by ID to avoid duplicates
 */
export async function importJournalData(data: ImportData): Promise<ImportResult> {
  const db = await getDatabase();

  if (!db) {
    throw new Error('Database not initialized');
  }

  const result: ImportResult = {
    success: true,
    imported: { days: 0, messages: 0, summaries: 0 },
    skipped: { days: 0, messages: 0, summaries: 0 },
    errors: [],
  };

  // Import days
  for (const day of data.days) {
    try {
      const existing = await db.days.findOne(day.id).exec();
      if (existing) {
        result.skipped.days++;
        continue;
      }
      await db.days.insert(day as Day);
      result.imported.days++;
    } catch (err) {
      result.errors.push(`Day ${day.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Import messages
  for (const message of data.messages) {
    try {
      const existing = await db.messages.findOne(message.id).exec();
      if (existing) {
        result.skipped.messages++;
        continue;
      }
      await db.messages.insert(message as Message);
      result.imported.messages++;
    } catch (err) {
      result.errors.push(
        `Message ${message.id}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  // Import summaries
  for (const summary of data.summaries) {
    try {
      const existing = await db.summaries.findOne(summary.id).exec();
      if (existing) {
        result.skipped.summaries++;
        continue;
      }
      await db.summaries.insert(summary as Summary);
      result.imported.summaries++;
    } catch (err) {
      result.errors.push(
        `Summary ${summary.id}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Read and import from a JSON file
 */
export async function importFromFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const json = JSON.parse(text) as unknown;
  const validated = validateImportData(json);
  return importJournalData(validated);
}
