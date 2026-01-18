import { useState } from 'react';
import { Calendar } from '../components/navigation/Calendar';
import { DayList } from '../components/navigation/DayList';
import { useDays } from '../hooks/useDay';
import { Button } from '@/components/ui/button';
import { CalendarDays, List, BookOpen } from 'lucide-react';

type ViewMode = 'calendar' | 'list';

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { days, isLoading } = useDays();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight m-0">Your Journal</h2>
            <p className="text-sm text-muted-foreground m-0">Browse your past entries</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="gap-2"
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-2"
          >
            <List className="w-4 h-4" />
            List
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        {viewMode === 'calendar' ? (
          <Calendar
            currentMonth={currentMonth}
            days={days}
            onMonthChange={setCurrentMonth}
          />
        ) : (
          <DayList days={days} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}
