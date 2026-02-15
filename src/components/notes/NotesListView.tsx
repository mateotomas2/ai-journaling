import { useMemo } from 'react';
import type { Note } from '@/types/entities';
import { NoteListItem } from './NoteListItem';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

interface NotesListViewProps {
  notes: Note[];
  isLoading: boolean;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function NotesListView({
  notes,
  isLoading,
  categories,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
}: NotesListViewProps) {
  const filteredNotes = useMemo(() => {
    let result = notes;

    if (selectedCategory) {
      result = result.filter((note) => note.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.content.toLowerCase().includes(query) ||
          note.title?.toLowerCase().includes(query) ||
          note.category.toLowerCase().includes(query)
      );
    }

    return result;
  }, [notes, selectedCategory, searchQuery]);

  // Filter out "summary" from category dropdown (already excluded from notes)
  const displayCategories = categories.filter((c) => c !== 'summary');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        Loading notes...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Filters */}
      <div className="flex gap-2 p-4 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {displayCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes list */}
      {filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2">
          <p>
            {notes.length === 0
              ? 'No notes yet.'
              : 'No notes match your filters.'}
          </p>
        </div>
      ) : (
        filteredNotes.map((note) => (
          <NoteListItem key={note.id} note={note} />
        ))
      )}
    </div>
  );
}
