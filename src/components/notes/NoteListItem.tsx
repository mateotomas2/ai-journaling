import { Link } from 'react-router-dom';
import type { Note } from '@/types/entities';
import { formatShortDate } from '@/utils/date.utils';
import { Badge } from '@/components/ui/badge';

interface NoteListItemProps {
  note: Note;
}

export function NoteListItem({ note }: NoteListItemProps) {
  const linkTo = `/journal/${note.dayId}?noteId=${note.id}`;

  // Strip markdown formatting for preview
  const contentPreview = note.content
    .replace(/[#*_~`>\[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  return (
    <Link
      to={linkTo}
      className="block p-4 border-b border-border transition-colors hover:bg-muted/50"
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
      <p className="text-sm text-muted-foreground line-clamp-2">
        {contentPreview || 'Empty note'}
      </p>
    </Link>
  );
}
