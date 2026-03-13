import { useNavigate } from 'react-router-dom';
import type { Note } from '@/types/entities';
import { formatShortDate } from '@/utils/date.utils';
import { Badge } from '@/components/ui/badge';

interface NotesMasonryCardProps {
  note: Note;
}

export function NotesMasonryCard({ note }: NotesMasonryCardProps) {
  const navigate = useNavigate();

  const contentPreview = note.content
    .replace(/[#*_~`>\[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  return (
    <div
      className="w-full cursor-pointer bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors"
      onClick={() => navigate(`/notes/${note.id}`)}
    >
      <div className="flex items-center gap-2 mb-1">
        {note.category && (
          <Badge variant="secondary" className="text-xs">
            {note.category}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {formatShortDate(note.dayId)}
        </span>
      </div>
      {note.title && (
        <h3 className="font-medium text-sm text-foreground mb-1 truncate">
          {note.title}
        </h3>
      )}
      <p className="text-sm text-muted-foreground line-clamp-4">
        {contentPreview || 'Empty note'}
      </p>
    </div>
  );
}
