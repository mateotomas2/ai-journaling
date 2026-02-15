import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { NoteEditorForm } from './NoteEditorForm';
import type { GeneratedNote } from '@/services/ai';
import { Plus } from 'lucide-react';

interface RegenerateNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  generatedNotes: GeneratedNote[];
  isGenerating: boolean;
  onApply: (notes: GeneratedNote[]) => void;
  onRegenerate: () => void;
  existingNotesCount: number;
  suggestedCategories?: string[];
}

export function RegenerateNotesModal({
  isOpen,
  onClose,
  generatedNotes: initialNotes,
  isGenerating,
  onApply,
  onRegenerate,
  existingNotesCount,
  suggestedCategories = [],
}: RegenerateNotesModalProps) {
  const [editedNotes, setEditedNotes] = useState<GeneratedNote[]>(initialNotes);

  // Sync with prop changes (when regenerating)
  useEffect(() => {
    if (initialNotes.length > 0 && !isGenerating) {
      setEditedNotes(initialNotes);
    }
  }, [initialNotes, isGenerating]);

  const handleNoteChange = (id: string, field: keyof GeneratedNote, value: string) => {
    setEditedNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, [field]: value } : note))
    );
  };

  const handleRemoveNote = (id: string) => {
    setEditedNotes((prev) => prev.filter((note) => note.id !== id));
  };

  const handleAddNote = () => {
    const newNote: GeneratedNote = {
      id: `new-${Date.now()}`,
      title: '',
      category: '',
      content: '',
    };
    setEditedNotes((prev) => [...prev, newNote]);
  };

  const handleApply = () => {
    onApply(editedNotes);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Notes with AI</DialogTitle>
          <DialogDescription>
            {isGenerating
              ? 'Analyzing your journal content...'
              : `Preview and edit the generated notes before applying.`}
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-500 dark:text-gray-400">Generating notes...</p>
            </div>
          </div>
        ) : (
          <>
            {existingNotesCount > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200">
                Applying will delete {existingNotesCount} existing note{existingNotesCount !== 1 ? 's' : ''} and create {editedNotes.length} new note{editedNotes.length !== 1 ? 's' : ''}.
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {editedNotes.map((note) => (
                <NoteEditorForm
                  key={note.id}
                  title={note.title}
                  category={note.category}
                  content={note.content}
                  onTitleChange={(title) => handleNoteChange(note.id, 'title', title)}
                  onCategoryChange={(category) => handleNoteChange(note.id, 'category', category)}
                  onContentChange={(content) => handleNoteChange(note.id, 'content', content)}
                  onDelete={() => handleRemoveNote(note.id)}
                  suggestedCategories={suggestedCategories}
                />
              ))}

              {editedNotes.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No notes generated. Click "Add Note" to create one manually.
                </div>
              )}
            </div>

            <button
              onClick={handleAddNote}
              className="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Note
            </button>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            Cancel
          </button>
          {!isGenerating && (
            <>
              <button
                onClick={onRegenerate}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
              >
                Regenerate
              </button>
              <button
                onClick={handleApply}
                disabled={editedNotes.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md"
              >
                Apply Changes
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
