import { useState, useRef, useEffect } from 'react';
import { useNotes, useNoteCategories, useSummaryNote } from '@/hooks/useNotes';
import { NoteCard } from './NoteCard';
import { generateSummary } from '@/services/ai/summary.service';
import { useSettings } from '@/hooks/useSettings';
import { useDatabase } from '@/hooks/useDatabase';
import { getSummarizerModel } from '@/services/settings/settings.service';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import type { Note, Message } from '@/types';

interface NotesListProps {
  dayId: string;
  highlightNoteId?: string | undefined;
}

export function NotesList({ dayId, highlightNoteId }: NotesListProps) {
  const { notes, isLoading, error, createNote, updateNote, updateNoteCategory, deleteNote } =
    useNotes(dayId);
  const { categories } = useNoteCategories();
  const { note: summaryNote } = useSummaryNote(dayId);
  const { apiKey } = useSettings();
  const { db } = useDatabase();

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when a note is added
  useEffect(() => {
    if (shouldScrollToBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      setShouldScrollToBottom(false);
    }
  }, [shouldScrollToBottom, notes]);

  // Group notes by category
  const notesByCategory = notes.reduce(
    (acc, note) => {
      if (!acc[note.category]) {
        acc[note.category] = [];
      }
      acc[note.category]!.push(note);
      return acc;
    },
    {} as Record<string, Note[]>
  );

  // Sort categories: "summary" first, then alphabetically
  const sortedCategories = Object.keys(notesByCategory).sort((a, b) => {
    if (a === 'summary') return -1;
    if (b === 'summary') return 1;
    return a.localeCompare(b);
  });

  const handleAddNote = async () => {
    try {
      // Create an empty note immediately - category will be added via modal
      await createNote('', '', undefined);
      setShouldScrollToBottom(true);
    } catch (err) {
      logger.error('Error creating note:', err);
      toast.error('Failed to create note. Please try again.');
    }
  };

  const handleGenerateSummary = async () => {
    logger.debug('[NotesList] Starting summary generation...');
    logger.debug('[NotesList] API Key present:', !!apiKey);
    logger.debug('[NotesList] Database present:', !!db);

    if (!apiKey) {
      toast.error('Please configure your OpenRouter API key in settings first.');
      return;
    }

    if (!db) {
      toast.error('Database not initialized.');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      // Get all messages for this day
      logger.debug('[NotesList] Fetching messages for day:', dayId);
      const messageDocs = await db.messages
        .find({
          selector: { dayId },
          sort: [{ timestamp: 'asc' }],
        })
        .exec();
      const messages = messageDocs.map((doc) => doc.toJSON()) as Message[];
      logger.debug('[NotesList] Found messages:', messages.length);

      // Get non-summary notes to check if we have content to summarize
      const nonSummaryNotes = notes.filter((n) => n.category !== 'summary');
      logger.debug('[NotesList] Found non-summary notes:', nonSummaryNotes.length);

      if (messages.length === 0 && nonSummaryNotes.length === 0) {
        toast.warning('No messages or notes to summarize for this day.');
        setIsGeneratingSummary(false);
        return;
      }

      // Get the user's selected summarizer model
      const summarizerModel = await getSummarizerModel(db);
      logger.debug('[NotesList] Using model:', summarizerModel);

      // Generate summary using AI
      logger.debug('[NotesList] Calling generateSummary...');
      const response = await generateSummary(
        messages,
        dayId,
        apiKey,
        db,
        summarizerModel
      );
      logger.debug('[NotesList] Summary generated, content length:', response.content.length);

      // Create summary note
      logger.debug('[NotesList] Creating note...');
      await createNote('summary', response.content);
      logger.debug('[NotesList] Note created successfully');
      toast.success('Summary generated successfully');
    } catch (err) {
      logger.error('[NotesList] Error generating summary:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to generate summary: ${errorMessage}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleRegenerateSummary = async () => {
    if (!apiKey || !summaryNote || !db) {
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const messageDocs = await db.messages
        .find({
          selector: { dayId },
          sort: [{ timestamp: 'asc' }],
        })
        .exec();
      const messages = messageDocs.map((doc) => doc.toJSON()) as Message[];

      // Get non-summary notes to check if we have content to summarize
      const nonSummaryNotes = notes.filter((n) => n.category !== 'summary');

      if (messages.length === 0 && nonSummaryNotes.length === 0) {
        toast.warning('No messages or notes to summarize for this day.');
        setIsGeneratingSummary(false);
        return;
      }

      // Get the user's selected summarizer model
      const summarizerModel = await getSummarizerModel(db);

      const response = await generateSummary(
        messages,
        dayId,
        apiKey,
        db,
        summarizerModel
      );

      await updateNote(summaryNote.id, response.content);
      toast.success('Summary regenerated successfully');
    } catch (err) {
      logger.error('Error regenerating summary:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to regenerate summary: ${errorMessage}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading notes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 dark:text-red-400">
          Error loading notes: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Summary section - special handling */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Summary
        </h2>
        {summaryNote ? (
          <>
            <NoteCard
              note={summaryNote}
              onUpdate={updateNote}
              onDelete={deleteNote}
              isSpecialCategory={true}
              highlight={highlightNoteId === summaryNote.id}
            />
            <button
              onClick={handleRegenerateSummary}
              disabled={isGeneratingSummary}
              className="mt-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:text-gray-400"
            >
              {isGeneratingSummary ? 'Regenerating...' : 'Regenerate Summary'}
            </button>
          </>
        ) : (
          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No summary generated yet
            </p>
            <button
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md"
            >
              {isGeneratingSummary ? 'Generating...' : 'Generate Summary'}
            </button>
          </div>
        )}
      </div>

      {/* Other categories */}
      {sortedCategories
        .filter((cat) => cat !== 'summary')
        .map((category) => (
          <div key={category || 'uncategorized'} className="mb-8">
            {category && (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 capitalize">
                {category}
              </h2>
            )}
            {notesByCategory[category]?.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={updateNote}
                onUpdateCategory={updateNoteCategory}
                onDelete={deleteNote}
                suggestedCategories={categories}
                highlight={highlightNoteId === note.id}
              />
            ))}
          </div>
        ))}

      {/* Scroll target for new notes */}
      <div ref={bottomRef} />

      {/* Add Note button */}
      <div className="mt-8">
        <button
          onClick={handleAddNote}
          className="w-full px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
        >
          + Add Note
        </button>
      </div>

      {/* Empty state */}
      {notes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No notes yet for this day
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Generate a summary or add your own notes
          </p>
        </div>
      )}
    </div>
  );
}
