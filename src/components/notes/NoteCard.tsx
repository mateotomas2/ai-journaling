import { useState, useRef, useEffect } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  ListsToggle,
  BlockTypeSelect,
  CreateLink,
  UndoRedo,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import type { Note } from '@/types';
import { CategoryModal } from './CategoryModal';

interface NoteCardProps {
  note: Note;
  onUpdate: (noteId: string, content: string, title?: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  onUpdateCategory?: (noteId: string, category: string) => Promise<void>;
  suggestedCategories?: string[];
  isSpecialCategory?: boolean; // For summary or other special categories
  highlight?: boolean; // Whether to highlight and scroll to this note
}

export function NoteCard({
  note,
  onUpdate,
  onDelete,
  onUpdateCategory,
  suggestedCategories = [],
  isSpecialCategory = false,
  highlight = false,
}: NoteCardProps) {
  const [editedContent, setEditedContent] = useState(note.content);
  const [editedTitle, setEditedTitle] = useState(note.title || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const editorRef = useRef<MDXEditorMethods>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle highlight and scroll
  useEffect(() => {
    if (highlight && cardRef.current) {
      // Scroll to the card
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Trigger highlight animation
      setIsHighlighted(true);
      // Remove highlight after animation completes
      const timeout = setTimeout(() => {
        setIsHighlighted(false);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [highlight]);

  useEffect(() => {
    setEditedContent(note.content);
    setEditedTitle(note.title || '');
    // Update the editor content when the note changes externally
    if (editorRef.current && note.content !== editedContent) {
      editorRef.current.setMarkdown(note.content);
    }
  }, [note.content, note.title]);

  const triggerAutoSave = (newContent: string, newTitle: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      if (newContent !== note.content || newTitle !== (note.title || '')) {
        setIsSaving(true);
        try {
          await onUpdate(
            note.id,
            newContent,
            newTitle.trim() || undefined
          );
        } catch (error) {
          console.error('Error saving note:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 2000);
  };

  const handleContentChange = (markdown: string) => {
    setEditedContent(markdown);
    triggerAutoSave(markdown, editedTitle);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setEditedTitle(newTitle);
    triggerAutoSave(editedContent, newTitle);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      await onDelete(note.id);
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  const handleCategorySelect = async (category: string) => {
    setShowCategoryModal(false);
    if (onUpdateCategory && category !== note.category) {
      try {
        await onUpdateCategory(note.id, category);
      } catch (error) {
        console.error('Error updating category:', error);
        alert('Failed to update category. Please try again.');
      }
    }
  };

  return (
    <div
      ref={cardRef}
      className={`bg-card text-card-foreground rounded-lg shadow-sm border p-4 mb-4 transition-all duration-500 ${
        isHighlighted
          ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
          : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          {isSpecialCategory ? (
            <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {note.category}
            </span>
          ) : note.category ? (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
            >
              {note.category}
            </button>
          ) : (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="inline-block px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              + add category
            </button>
          )}
          {isSaving && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Saving...
            </span>
          )}
        </div>
        {!isSpecialCategory && (
          <button
            onClick={handleDelete}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              showDeleteConfirm
                ? 'text-white bg-red-600 hover:bg-red-700'
                : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
            }`}
          >
            {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Title input (only for non-special categories) */}
        {!isSpecialCategory && (
          <input
            type="text"
            value={editedTitle}
            onChange={handleTitleChange}
            placeholder="Untitled"
            className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
          />
        )}

        {/* Markdown editor */}
        <MDXEditor
          ref={editorRef}
          markdown={editedContent}
          onChange={handleContentChange}
          contentEditableClassName="prose prose-sm max-w-none min-h-[200px] focus:outline-none"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            markdownShortcutPlugin(),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <BlockTypeSelect />
                  <BoldItalicUnderlineToggles />
                  <ListsToggle />
                  <CreateLink />
                </>
              ),
            }),
          ]}
        />
      </div>

      {/* Metadata */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        Last updated:{' '}
        {new Date(note.updatedAt).toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short',
        })}
      </div>

      {/* Category Modal */}
      <CategoryModal
        isOpen={showCategoryModal}
        currentCategory={note.category}
        suggestedCategories={suggestedCategories}
        onSelect={handleCategorySelect}
        onClose={() => setShowCategoryModal(false)}
      />
    </div>
  );
}
