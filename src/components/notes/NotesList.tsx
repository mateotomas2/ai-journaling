import { useState } from 'react';
import { useNotes, useNoteCategories, useSummaryNote } from '@/hooks/useNotes';
import { NoteCard } from './NoteCard';
import { generateSummary } from '@/services/ai/summary.service';
import { useSettings } from '@/hooks/useSettings';
import { useDatabase } from '@/hooks/useDatabase';
import { getSummarizerModel } from '@/services/settings/settings.service';
import type { Note, Message } from '@/types';

interface NotesListProps {
  dayId: string;
}

export function NotesList({ dayId }: NotesListProps) {
  const { notes, isLoading, error, createNote, updateNote, deleteNote } =
    useNotes(dayId);
  const { categories } = useNoteCategories();
  const { note: summaryNote } = useSummaryNote(dayId);
  const { apiKey } = useSettings();
  const { db } = useDatabase();

  const [showAddNote, setShowAddNote] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

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

  const handleCreateNote = async () => {
    if (!newCategory.trim() || !newContent.trim()) {
      alert('Please provide both a category and content for the note.');
      return;
    }

    try {
      await createNote(
        newCategory.trim(),
        newContent.trim(),
        newTitle.trim() || undefined
      );
      // Reset form
      setNewCategory('');
      setNewTitle('');
      setNewContent('');
      setShowAddNote(false);
    } catch (err) {
      console.error('Error creating note:', err);
      alert('Failed to create note. Please try again.');
    }
  };

  const handleGenerateSummary = async () => {
    console.log('[NotesList] Starting summary generation...');
    console.log('[NotesList] API Key present:', !!apiKey);
    console.log('[NotesList] Database present:', !!db);

    if (!apiKey) {
      alert('Please configure your OpenRouter API key in settings first.');
      return;
    }

    if (!db) {
      alert('Database not initialized.');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      // Get all messages for this day
      console.log('[NotesList] Fetching messages for day:', dayId);
      const messageDocs = await db.messages
        .find({
          selector: { dayId },
          sort: [{ timestamp: 'asc' }],
        })
        .exec();
      const messages = messageDocs.map((doc) => doc.toJSON()) as Message[];
      console.log('[NotesList] Found messages:', messages.length);

      if (messages.length === 0) {
        alert('No messages to summarize for this day.');
        setIsGeneratingSummary(false);
        return;
      }

      // Get the user's selected summarizer model
      const summarizerModel = await getSummarizerModel(db);
      console.log('[NotesList] Using model:', summarizerModel);

      // Generate summary using AI
      console.log('[NotesList] Calling generateSummary...');
      const response = await generateSummary(
        messages,
        dayId,
        apiKey,
        db,
        summarizerModel
      );
      console.log('[NotesList] Summary generated, content length:', response.content.length);

      // Create summary note
      console.log('[NotesList] Creating note...');
      await createNote('summary', response.content);
      console.log('[NotesList] Note created successfully');
    } catch (err) {
      console.error('[NotesList] Error generating summary:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(
        `Failed to generate summary: ${errorMessage}\n\nPlease check your API key and try again.`
      );
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

      if (messages.length === 0) {
        alert('No messages to summarize for this day.');
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
    } catch (err) {
      console.error('Error regenerating summary:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(
        `Failed to regenerate summary: ${errorMessage}\n\nPlease check your API key and try again.`
      );
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
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
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 capitalize">
              {category}
            </h2>
            {notesByCategory[category]?.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={updateNote}
                onDelete={deleteNote}
              />
            ))}
          </div>
        ))}

      {/* Add Note section */}
      <div className="mt-8">
        {showAddNote ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
              Add New Note
            </h3>

            {/* Category selection */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {categories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Suggestions:
                  </span>
                  {categories
                    .filter((cat) => cat !== 'summary')
                    .map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        {cat}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Title input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title (optional)
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Untitled"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Content input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content
              </label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write your note content here (supports markdown)..."
                rows={6}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCreateNote}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Create Note
              </button>
              <button
                onClick={() => {
                  setShowAddNote(false);
                  setNewCategory('');
                  setNewTitle('');
                  setNewContent('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddNote(true)}
            className="w-full px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
          >
            + Add Note
          </button>
        )}
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
