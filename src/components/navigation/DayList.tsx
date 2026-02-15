import { Link } from 'react-router-dom';
import type { Day } from '../../types/entities';
import { formatDayId, isDayToday } from '../../utils/date.utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DayListProps {
  days: Day[];
  isLoading?: boolean;
  noteCounts?: Record<string, number>;
}

export function DayList({ days, isLoading, noteCounts }: DayListProps) {
  if (isLoading) {
    return <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-4">Loading days...</div>;
  }

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-4">
        <p>No journal entries yet.</p>
        <Link to="/journal" className="text-primary hover:underline font-medium">Start journaling today</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {days.map((day) => {
        const linkTo = `/journal/${day.id}`;
        const isToday = isDayToday(day.id);

        return (
          <Link
            key={day.id}
            to={linkTo}
            className={cn(
              "flex justify-between items-center p-4 border-b border-border text-foreground transition-colors hover:bg-muted/50",
              isToday && "bg-muted/30"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatDayId(day.id)}</span>
              {isToday && <Badge>Today</Badge>}
            </div>
            <div className="flex gap-2">
              {noteCounts && (noteCounts[day.id] ?? 0) > 0 && (
                <Badge variant="secondary">{noteCounts[day.id]} {noteCounts[day.id] === 1 ? 'note' : 'notes'}</Badge>
              )}
              {day.hasSummary && <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">Summary</Badge>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
