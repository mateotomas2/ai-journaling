import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChatInterface } from '../components/chat/ChatInterface';
import { NotesList } from '../components/notes/NotesList';
import { formatDayId, isValidDayId, getTodayId } from '../utils/date.utils';
import { setSelectedDay } from '../utils/session.utils';
import { addDays, format, parse } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'chat' | 'notes';

export function JournalPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Validate date from URL
  const dayId = date && isValidDayId(date) ? date : null;

  // Save to session storage whenever dayId changes
  useEffect(() => {
    if (dayId) {
      setSelectedDay(dayId);
    }
  }, [dayId]);

  // Navigate to previous day
  const handlePreviousDay = useCallback(() => {
    if (!dayId) return;
    const currentDate = parse(dayId, 'yyyy-MM-dd', new Date());
    const previousDate = addDays(currentDate, -1);
    const previousDayId = format(previousDate, 'yyyy-MM-dd');
    navigate(`/journal/${previousDayId}`);
  }, [dayId, navigate]);

  // Navigate to next day
  const handleNextDay = useCallback(() => {
    if (!dayId) return;
    const currentDate = parse(dayId, 'yyyy-MM-dd', new Date());
    const nextDate = addDays(currentDate, 1);
    const nextDayId = format(nextDate, 'yyyy-MM-dd');
    navigate(`/journal/${nextDayId}`);
  }, [dayId, navigate]);

  // Handle date selection from calendar
  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      const selectedDayId = format(date, 'yyyy-MM-dd');
      navigate(`/journal/${selectedDayId}`);
      setIsCalendarOpen(false);
    }
  }, [navigate]);

  // Redirect to today if invalid date
  if (!dayId) {
    return <Navigate to={`/journal/${getTodayId()}`} replace />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Date Navigation Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousDay}
            className="h-9 w-9 p-0"
            title="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-medium min-w-[200px]",
                  !dayId && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDayId(dayId)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parse(dayId, 'yyyy-MM-dd', new Date())}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextDay}
            className="h-9 w-9 p-0"
            title="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

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

      {/* Content */}
      <div className="flex-1 rounded-xl border border-border bg-card shadow-sm overflow-auto">
        <JournalPageContent dayId={dayId} viewMode={viewMode} />
      </div>
    </div>
  );
}

interface JournalPageContentProps {
  dayId: string;
  viewMode: ViewMode;
}

function JournalPageContent({ dayId, viewMode }: JournalPageContentProps) {
  return (
    <>
      {viewMode === 'notes' ? (
        <NotesList dayId={dayId} />
      ) : (
        <ChatInterface dayId={dayId} />
      )}
    </>
  );
}
