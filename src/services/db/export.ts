/**
 * Data Export Service
 * Exports journal data to JSON format
 */

import { getDatabase } from '@/db';
import type { Day, Message, Summary } from '@/types';
import type { Note } from '@/types/entities';

export interface ExportData {
  version: string;
  exportedAt: string;
  days: Day[];
  messages: Message[];
  summaries: Summary[];
}

/**
 * Export all journal data to JSON
 */
export async function exportJournalData(): Promise<ExportData> {
  const db = await getDatabase();

  if (!db) {
    throw new Error('Database not initialized');
  }

  const [daysResult, messagesResult, summariesResult] = await Promise.all([
    db.days.find().exec(),
    db.messages.find().exec(),
    db.summaries.find().exec(),
  ]);

  const days = daysResult.map((doc) => doc.toJSON() as Day);
  const messages = messagesResult.map((doc) => doc.toJSON() as Message);
  const summaries = summariesResult.map((doc) => doc.toJSON() as Summary);

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    days,
    messages,
    summaries,
  };
}

/**
 * Download export data as a JSON file
 */
export async function downloadExport(): Promise<void> {
  const data = await exportJournalData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `reflekt-export-${data.exportedAt.split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export data for a specific date range
 */
export interface SyncData {
  version: string;
  syncedAt: string;
  days: Day[];
  messages: Message[];
  summaries: Summary[];
  notes: Note[];
}

export async function exportAllSyncData(): Promise<SyncData> {
  const db = await getDatabase();

  if (!db) {
    throw new Error('Database not initialized');
  }

  const [daysResult, messagesResult, summariesResult, notesResult] = await Promise.all([
    db.days.find().exec(),
    db.messages.find().exec(),
    db.summaries.find().exec(),
    db.notes.find().exec(),
  ]);

  return {
    version: '1.0.0',
    syncedAt: new Date().toISOString(),
    days: daysResult.map((doc) => doc.toJSON() as Day),
    messages: messagesResult.map((doc) => doc.toJSON() as Message),
    summaries: summariesResult.map((doc) => doc.toJSON() as Summary),
    notes: notesResult.map((doc) => doc.toJSON() as Note),
  };
}

export async function exportDateRange(startDate: string, endDate: string): Promise<ExportData> {
  const db = await getDatabase();

  if (!db) {
    throw new Error('Database not initialized');
  }

  const [daysResult, messagesResult, summariesResult] = await Promise.all([
    db.days.find({ selector: { id: { $gte: startDate, $lte: endDate } } }).exec(),
    db.messages.find({ selector: { dayId: { $gte: startDate, $lte: endDate } } }).exec(),
    db.summaries.find({ selector: { dayId: { $gte: startDate, $lte: endDate } } }).exec(),
  ]);

  const days = daysResult.map((doc) => doc.toJSON() as Day);
  const messages = messagesResult.map((doc) => doc.toJSON() as Message);
  const summaries = summariesResult.map((doc) => doc.toJSON() as Summary);

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    days,
    messages,
    summaries,
  };
}
