import { useState, useRef, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { Note } from '@/types';

interface NoteCardProps {
  note: Note;
  onUpdate: (noteId: string, content: string, title?: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  isSpecialCategory?: boolean; // For summary or other special categories
}

export function NoteCard({
  note,
  onUpdate,
  onDelete,
  isSpecialCategory = false,
}: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(note.content);
  const [editedTitle, setEditedTitle] = useState(note.title || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setEditedContent(note.content);
    setEditedTitle(note.title || '');
  }, [note.content, note.title]);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onUpdate(
        note.id,
        editedContent,
        editedTitle.trim() || undefined
      );
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(note.content);
    setEditedTitle(note.title || '');
    setIsEditing(false);
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

  const handleContentChange = (value?: string) => {
    setEditedContent(value || '');

    // Auto-save after 2 seconds of no typing
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      if (value !== note.content || editedTitle !== (note.title || '')) {
        handleSave();
      }
    }, 2000);
  };

  const getPreviewText = () => {
    // Remove markdown syntax for preview
    const plainText = note.content
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .trim();

    // Get first line or first 100 chars
    const firstLine = plainText.split('\n')[0] || '';
    return firstLine.length > 100
      ? firstLine.substring(0, 100) + '...'
      : firstLine;
  };

  const displayTitle = note.title || getPreviewText() || 'Untitled';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
            {note.category}
          </span>
          {!isEditing && (
            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {displayTitle}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && !isSpecialCategory && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Edit
            </button>
          )}
          {!isEditing && isSpecialCategory && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              View/Edit
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-3">
          {/* Title input (only for non-special categories) */}
          {!isSpecialCategory && (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="Untitled"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          )}

          {/* Markdown editor */}
          <div data-color-mode="light">
            <MDEditor
              value={editedContent}
              onChange={handleContentChange}
              preview="edit"
              height={300}
              visibleDragbar={false}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
              >
                Cancel
              </button>
            </div>
            {!isSpecialCategory && (
              <button
                onClick={handleDelete}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  showDeleteConfirm
                    ? 'text-white bg-red-600 hover:bg-red-700'
                    : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                }`}
              >
                {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="prose dark:prose-invert prose-sm max-w-none cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded p-2 -m-2"
          onClick={() => setIsEditing(true)}
        >
          <MDEditor.Markdown source={note.content} />
        </div>
      )}

      {/* Metadata */}
      {!isEditing && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          Last updated:{' '}
          {new Date(note.updatedAt).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </div>
      )}
    </div>
  );
}
