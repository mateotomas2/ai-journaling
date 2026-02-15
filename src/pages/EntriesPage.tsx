import { useState } from 'react';
import { DayList } from '../components/navigation/DayList';
import { NotesListView } from '../components/notes/NotesListView';
import { useDays } from '../hooks/useDay';
import { useAllNotes, useNoteCountsByDay, useNoteCategories } from '../hooks/useNotes';
import { Calendar, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'by-day' | 'notes';

export function EntriesPage() {
  const { days, isLoading: daysLoading } = useDays();
  const { notes, isLoading: notesLoading } = useAllNotes();
  const { counts: noteCounts } = useNoteCountsByDay();
  const { categories } = useNoteCategories();

  const [viewMode, setViewMode] = useState<ViewMode>('by-day');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
            {viewMode === 'by-day' ? (
              <Calendar className="w-5 h-5" />
            ) : (
              <StickyNote className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight m-0">All Entries</h2>
            <p className="text-sm text-muted-foreground m-0">
              {viewMode === 'by-day'
                ? 'Browse all your journal entries'
                : 'Browse all your notes'}
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('by-day')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'by-day'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">By Day</span>
          </button>
          <button
            onClick={() => setViewMode('notes')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'notes'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <StickyNote className="w-4 h-4" />
            <span className="hidden sm:inline">Notes</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {viewMode === 'by-day' ? (
          <DayList days={days} isLoading={daysLoading} noteCounts={noteCounts} />
        ) : (
          <NotesListView
            notes={notes}
            isLoading={notesLoading}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
      </div>
    </div>
  );
}
