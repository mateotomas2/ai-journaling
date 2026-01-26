import { useState } from 'react';
import { Button } from '@/components/ui/button';

import { useParams, Link } from 'react-router-dom';
import { ChatInterface } from '../components/chat/ChatInterface';
import { NotesList } from '../components/notes/NotesList';
import { formatDayId, isValidDayId } from '../utils/date.utils';


type ViewMode = 'chat' | 'notes';

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  if (!date || !isValidDayId(date)) {
    return (
      <div className="day-page-error">
        <p>Invalid date format</p>
        <Link to="/entries">Back to Entries</Link>
      </div>
    );
  }

  return <DayPageContent dayId={date} viewMode={viewMode} setViewMode={setViewMode} />;
}

interface DayPageContentProps {
  dayId: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

function DayPageContent({ dayId, viewMode, setViewMode }: DayPageContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b bg-muted/30">
        <h2 className="text-base font-medium text-muted-foreground m-0">{formatDayId(dayId)}</h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'notes' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('notes')}
          >
            Notes
          </Button>
          <Button
            variant={viewMode === 'chat' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('chat')}
          >
            Chat
          </Button>
        </div>
      </div>

      {viewMode === 'notes' ? (
        <div className="flex-1 overflow-y-auto">
          <NotesList dayId={dayId} />
        </div>
      ) : (
        <ChatInterface dayId={dayId} />
      )}
    </div>
  );
}
