import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import type { Note } from '../types/entities';

/**
 * Hook to manage notes for a specific day
 * Optionally filter by category
 */
export function useNotes(dayId: string, category?: string) {
  const { db } = useDatabase();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    const selector: { dayId: string; category?: string } = { dayId };
    if (category) {
      selector.category = category;
    }

    const subscription = db.notes
      .find({
        selector,
        sort: [{ createdAt: 'desc' }],
      })
      .$.subscribe({
        next: (docs) => {
          setNotes(docs.map((doc) => doc.toJSON()));
          setIsLoading(false);
          setError(null);
        },
        error: (err) => {
          console.error('Error fetching notes:', err);
          setError(err as Error);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [db, dayId, category]);

  const createNote = useCallback(
    async (
      noteCategory: string,
      content: string,
      title?: string
    ): Promise<Note> => {
      if (!db) throw new Error('Database not initialized');
      try {
        const note = await db.notes.insert({
          id: crypto.randomUUID(),
          dayId,
          category: noteCategory,
          ...(title ? { title } : {}),
          content,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return note.toJSON();
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      }
    },
    [dayId, db]
  );

  const updateNote = useCallback(
    async (noteId: string, content: string, title?: string): Promise<void> => {
      if (!db) throw new Error('Database not initialized');
      try {
        const doc = await db.notes.findOne(noteId).exec();
        if (!doc) {
          throw new Error('Note not found');
        }
        await doc.patch({
          content,
          title,
          updatedAt: Date.now(),
        });
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      }
    },
    [db]
  );

  const deleteNote = useCallback(async (noteId: string): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    try {
      const doc = await db.notes.findOne(noteId).exec();
      if (!doc) {
        throw new Error('Note not found');
      }
      await doc.remove();
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    }
  }, [db]);

  return {
    notes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
  };
}

/**
 * Hook to get all unique note categories
 */
export function useNoteCategories() {
  const { db } = useDatabase();
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    // Subscribe to all notes to get categories
    const subscription = db.notes.find().$.subscribe({
      next: async (docs) => {
        // When notes change, refresh categories
        try {
          const notes = docs.map((doc) => doc.toJSON());
          const categorySet = new Set<string>();
          notes.forEach((note) => {
            categorySet.add(note.category);
          });
          const cats = Array.from(categorySet).sort();
          setCategories(cats);
          setIsLoading(false);
        } catch (error) {
          console.error('Error fetching categories:', error);
          setIsLoading(false);
        }
      },
      error: (err) => {
        console.error('Error subscribing to notes:', err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [db]);

  return { categories, isLoading };
}

/**
 * Convenience hook for managing the summary note specifically
 */
export function useSummaryNote(dayId: string) {
  const { notes, isLoading, error, createNote, updateNote } = useNotes(
    dayId,
    'summary'
  );

  // Get the first (and should be only) summary note
  const note = notes.length > 0 ? notes[0] : null;

  const generateSummary = useCallback(
    async (content: string): Promise<Note> => {
      return await createNote('summary', content);
    },
    [createNote]
  );

  const regenerateSummary = useCallback(
    async (content: string): Promise<void> => {
      if (!note) {
        throw new Error('No summary note to regenerate');
      }
      await updateNote(note.id, content);
    },
    [note, updateNote]
  );

  return {
    note,
    isLoading,
    error,
    generateSummary,
    regenerateSummary,
  };
}
