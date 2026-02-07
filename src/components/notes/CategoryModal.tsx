import { useState, useRef, useEffect, useCallback } from 'react';

interface CategoryModalProps {
  isOpen: boolean;
  currentCategory?: string;
  suggestedCategories: string[];
  onSelect: (category: string) => void;
  onClose: () => void;
}

export function CategoryModal({
  isOpen,
  currentCategory,
  suggestedCategories,
  onSelect,
  onClose,
}: CategoryModalProps) {
  const [inputValue, setInputValue] = useState(currentCategory || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const saveAndClose = useCallback(() => {
    const trimmedValue = inputValue.trim();
    // Save if value changed (including clearing to empty)
    if (trimmedValue !== (currentCategory || '')) {
      onSelect(trimmedValue);
    } else {
      onClose();
    }
  }, [inputValue, currentCategory, onSelect, onClose]);

  useEffect(() => {
    if (isOpen) {
      setInputValue(currentCategory || '');
      // Auto-focus input when modal opens (triggers keyboard on mobile)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, currentCategory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        saveAndClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        saveAndClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, saveAndClose]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAndClose();
    }
  };

  const handleSelectSuggestion = (category: string) => {
    onSelect(category);
  };

  // Filter out 'summary' and empty categories from suggestions
  const filteredSuggestions = suggestedCategories.filter(
    (cat) => cat && cat !== 'summary'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="bg-card text-card-foreground rounded-lg shadow-xl w-full max-w-sm mx-4 p-4"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {currentCategory ? 'Edit Category' : 'Add Category'}
        </h3>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter category name"
          className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
        />

        {filteredSuggestions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Suggested categories:
            </p>
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectSuggestion(cat)}
                  className="px-3 py-1.5 text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-md transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
