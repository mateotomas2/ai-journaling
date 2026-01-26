import type { JournalDatabase } from '@/db';
import type { Note } from '@/types';

/**
 * Generate a UUID for note IDs
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Create a new note
 */
export async function createNote(
  db: JournalDatabase,
  dayId: string,
  category: string,
  content: string,
  title?: string
): Promise<Note> {

  const now = Date.now();
  const baseNote = {
    id: generateUUID(),
    dayId,
    category,
    content,
    createdAt: now,
    updatedAt: now,
  };

  const note: Note = title
    ? { ...baseNote, title }
    : baseNote;

  const doc = await db.notes.insert(note);
  return doc.toJSON();
}

/**
 * Update an existing note
 */
export async function updateNote(
  db: JournalDatabase,
  noteId: string,
  content: string,
  title?: string
): Promise<Note | null> {
  const doc = await db.notes.findOne(noteId).exec();

  if (!doc) {
    return null;
  }

  await doc.update({
    $set: {
      content,
      title,
      updatedAt: Date.now(),
    },
  });

  return doc.toJSON();
}

/**
 * Get all notes for a specific day, optionally filtered by category
 */
export async function getNotesForDay(
  db: JournalDatabase,
  dayId: string,
  category?: string
): Promise<Note[]> {

  const selector: { dayId: string; category?: string } = { dayId };
  if (category) {
    selector.category = category;
  }

  const docs = await db.notes
    .find({
      selector,
      sort: [{ createdAt: 'desc' }],
    })
    .exec();

  return docs.map((doc) => doc.toJSON());
}

/**
 * Get the summary note for a specific day (convenience function)
 */
export async function getSummaryNote(db: JournalDatabase, dayId: string): Promise<Note | null> {
  const notes = await getNotesForDay(db, dayId, 'summary');
  return notes.length > 0 ? (notes[0] ?? null) : null;
}

/**
 * Delete a note
 */
export async function deleteNote(db: JournalDatabase, noteId: string): Promise<boolean> {
  const doc = await db.notes.findOne(noteId).exec();

  if (doc) {
    await doc.remove();
    return true;
  }

  return false;
}

/**
 * Get notes in a date range, optionally filtered by category
 */
export async function getNotesInRange(
  db: JournalDatabase,
  startDate: string,
  endDate: string,
  category?: string
): Promise<Note[]> {

  const selector: {
    dayId: { $gte: string; $lte: string };
    category?: string;
  } = {
    dayId: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  if (category) {
    selector.category = category;
  }

  const docs = await db.notes
    .find({
      selector,
      sort: [{ dayId: 'desc' }, { createdAt: 'desc' }],
    })
    .exec();

  return docs.map((doc) => doc.toJSON());
}

/**
 * Get the N most recent notes, optionally filtered by category
 */
export async function getRecentNotes(
  db: JournalDatabase,
  limit: number,
  category?: string
): Promise<Note[]> {

  const selector = category ? { category } : {};

  const docs = await db.notes
    .find({
      selector,
      sort: [{ createdAt: 'desc' }],
      limit,
    })
    .exec();

  return docs.map((doc) => doc.toJSON());
}

/**
 * Check if a day has a summary note
 */
export async function hasSummaryNote(db: JournalDatabase, dayId: string): Promise<boolean> {
  const summaryNote = await getSummaryNote(db, dayId);
  return summaryNote !== null;
}

/**
 * Get all unique categories used across all notes
 */
export async function getAllCategories(db: JournalDatabase): Promise<string[]> {
  const docs = await db.notes.find().exec();
  const categories = new Set<string>();

  docs.forEach((doc) => {
    const note = doc.toJSON();
    categories.add(note.category);
  });

  return Array.from(categories).sort();
}
