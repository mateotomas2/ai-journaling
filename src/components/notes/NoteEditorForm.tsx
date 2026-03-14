import { useRef, useEffect, useState } from 'react';
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
import { CategoryModal } from './CategoryModal';

// MDXEditor collapses 3+ consecutive newlines to a single paragraph break.
// Encode extra blank lines as <br /> placeholders before passing to the editor,
// then decode them back from onChange output.
function encodeBlankLines(markdown: string): string {
  return markdown.replace(/\n{3,}/g, (match) => {
    const extras = Math.floor((match.length - 2) / 2);
    return '\n\n' + '<br />\n\n'.repeat(extras);
  });
}

function decodeBlankLines(markdown: string): string {
  return markdown.replace(/(<br \/>(\r?\n)+)+/g, (match) => {
    const count = (match.match(/<br \/>/g) || []).length;
    return '\n\n'.repeat(count);
  });
}

export interface NoteFormData {
  title: string;
  category: string;
  content: string;
}

interface NoteEditorFormProps {
  title: string;
  category: string;
  content: string;
  onTitleChange: (title: string) => void;
  onCategoryChange: (category: string) => void;
  onContentChange: (content: string) => void;
  onDelete: () => void;
  suggestedCategories?: string[];
  isSaving?: boolean;
  highlight?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export function NoteEditorForm({
  title,
  category,
  content,
  onTitleChange,
  onCategoryChange,
  onContentChange,
  suggestedCategories = [],
  isSaving = false,
  onBlur,
  autoFocus = false,
}: NoteEditorFormProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const lastEditorContentRef = useRef(content);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Imperatively update MDXEditor when content changes externally (e.g. from sync)
  useEffect(() => {
    if (editorRef.current && content !== lastEditorContentRef.current) {
      editorRef.current.setMarkdown(encodeBlankLines(content));
    }
    lastEditorContentRef.current = content;
  }, [content]);

  // Auto-focus the editor when opening a new note
  useEffect(() => {
    if (autoFocus) {
      const timeout = setTimeout(() => {
        editorRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [autoFocus]);



  const handleCategorySelect = (newCategory: string) => {
    setShowCategoryModal(false);
    if (newCategory !== category) {
      onCategoryChange(newCategory);
    }
  };

  return (
    <div
      className={`bg-card text-card-foreground p-4 transition-all duration-500 min-h-full flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 space-x-2">
        {/* Title input */}
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => onBlur?.()}
          placeholder="Untitled"
          className="w-full px-3 py-1 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
        />
        <div className="flex items-center gap-2 flex-1">
          {category ? (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="inline-block px-2 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
            >
              {category}
            </button>
          ) : (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="min-w-30 inline-block px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
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
      </div>

      {/* Content */}
      {/* Markdown editor */}
      <div onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onBlur?.();
        }
      }} className="flex-1">
        <MDXEditor
          ref={editorRef}
          markdown={encodeBlankLines(content)}
          onChange={(markdown) => {
            const decoded = decodeBlankLines(markdown);
            lastEditorContentRef.current = decoded;
            onContentChange(decoded);
          }}
          contentEditableClassName="prose prose-sm max-w-none min-h-[200px] focus:outline-none text-sm"
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

      {/* Category Modal */}
      <CategoryModal
        isOpen={showCategoryModal}
        currentCategory={category}
        suggestedCategories={suggestedCategories}
        onSelect={handleCategorySelect}
        onClose={() => setShowCategoryModal(false)}
      />
    </div>
  );
}
