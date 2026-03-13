import { useState, useEffect } from 'react';
import { useAllNotes } from '@/hooks/useNotes';
import { NotesMasonryCard } from '@/components/notes/NotesMasonryCard';
import { StickyNote } from 'lucide-react';

export function NotesPage() {
  const { notes, isLoading } = useAllNotes();
  const [cols, setCols] = useState(() => (window.innerWidth >= 500 ? 2 : 1));
  useEffect(() => {
    const handler = () => setCols(window.innerWidth >= 500 ? 2 : 1);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const mid = Math.ceil(notes.length / 2);
  const leftCol = cols === 2 ? notes.slice(0, mid) : notes;
  const rightCol = cols === 2 ? notes.slice(mid) : [];

  return (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-6">
        <StickyNote className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Notes</h1>
        <span className="text-sm text-muted-foreground ml-1">({notes.length})</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading notes...</p>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <StickyNote className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notes yet.</p>
        </div>
      ) : (
        <div className="flex gap-3">
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
