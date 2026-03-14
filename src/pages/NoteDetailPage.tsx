import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useNoteById } from '@/hooks/useNotes';
import { NoteEditorForm } from '@/components/notes/NoteEditorForm';
import { useNoteCategories } from '@/hooks/useNotes';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoFocus = searchParams.get('autoFocus') === '1';
  const { note, isLoading, updateNote, updateNoteCategory, deleteNote } = useNoteById(noteId!);
  const { categories } = useNoteCategories();

  const [editedContent, setEditedContent] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSavedContent = useRef('');
  const lastSavedTitle = useRef('');

  // Initialize local state once note loads
  useEffect(() => {
    if (note) {
      setEditedContent(note.content);
      setEditedTitle(note.title || '');
      setEditedCategory(note.category);
      lastSavedContent.current = note.content;
      lastSavedTitle.current = note.title || '';
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty =
    editedContent !== lastSavedContent.current ||
    editedTitle !== lastSavedTitle.current;

  const saveImmediately = async (content: string, title: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (content !== lastSavedContent.current || title !== lastSavedTitle.current) {
      try {
        await updateNote(content, title.trim() || undefined);
        lastSavedContent.current = content;
        lastSavedTitle.current = title;
      } catch (err) {
        console.error('Auto-save on blur failed:', err);
      }
    }
  };

  const triggerAutoSave = (content: string, title: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      if (content !== lastSavedContent.current || title !== lastSavedTitle.current) {
        try {
          await updateNote(content, title.trim() || undefined);
          lastSavedContent.current = content;
          lastSavedTitle.current = title;
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }
    }, 2000);
  };

  const handleContentChange = (content: string) => {
    setEditedContent(content);
    triggerAutoSave(content, editedTitle);
  };

  const handleTitleChange = (title: string) => {
    setEditedTitle(title);
    triggerAutoSave(editedContent, title);
  };

  const handleCategoryChange = async (category: string) => {
    setEditedCategory(category);
    try {
      await updateNoteCategory(category);
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const handleSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    try {
      await updateNote(editedContent, editedTitle.trim() || undefined);
      lastSavedContent.current = editedContent;
      lastSavedTitle.current = editedTitle;
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
    navigate(-1);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteNote();
      navigate(-1);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Note not found.</p>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            Back to Notes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-md hover:bg-muted transition-colors"
          aria-label="Back to notes"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 mx-3 truncate">
          {editedCategory ? (
            <Badge variant="secondary" className="text-xs">
              {editedCategory}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Save note"
          >
            <Save className="w-5 h-5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-destructive"
            aria-label="Delete note"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scrollable editor */}
      <div className="flex-1 overflow-y-auto">
        <NoteEditorForm
          title={editedTitle}
          category={editedCategory}
          content={editedContent}
          onTitleChange={handleTitleChange}
          onCategoryChange={handleCategoryChange}
          onContentChange={handleContentChange}
          onBlur={() => saveImmediately(editedContent, editedTitle)}
          onDelete={handleDelete}
          suggestedCategories={categories}
          isSaving={isSaving}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}
