import { useMemo, useState, useEffect } from 'react';
import type { Note } from '@/types/entities';
import { NotesMasonryCard } from './NotesMasonryCard';
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
  const [cols, setCols] = useState(() => (window.innerWidth >= 500 ? 2 : 1));
  useEffect(() => {
    const handler = () => setCols(window.innerWidth >= 500 ? 2 : 1);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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

  const mid = Math.ceil(filteredNotes.length / 2);
  const leftCol = cols === 2 ? filteredNotes.slice(0, mid) : filteredNotes;
  const rightCol = cols === 2 ? filteredNotes.slice(mid) : [];

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
        <div className="flex gap-3 p-4">
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            {leftCol.map((note) => (
              <NotesMasonryCard key={note.id} note={note} />
            ))}
          </div>
          {cols === 2 && (
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              {rightCol.map((note) => (
                <NotesMasonryCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
