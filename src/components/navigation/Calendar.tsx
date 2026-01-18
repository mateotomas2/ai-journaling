import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  getDay,
  addMonths,
  subMonths,
} from 'date-fns';
import type { Day } from '../../types/entities';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarProps {
  currentMonth: Date;
  days: Day[];
  onMonthChange: (month: Date) => void;
}

export function Calendar({ currentMonth, days, onMonthChange }: CalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const calendarDays = useMemo(() => {
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add padding for days before the first of the month
    const startPadding = getDay(monthStart);
    const paddedDays: (Date | null)[] = Array(startPadding).fill(null);

    return [...paddedDays, ...daysInMonth];
  }, [monthStart, monthEnd]);

  const dayMap = useMemo(() => {
    const map = new Map<string, Day>();
    days.forEach((day) => map.set(day.id, day));
    return map;
  }, [days]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6 p-3 bg-muted/50 rounded-lg">
        <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold m-0">{format(currentMonth, 'MMMM yyyy')}</h3>
        <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-[2px] mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground p-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {calendarDays.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="aspect-square invisible" />;
          }

          const dayId = format(date, 'yyyy-MM-dd');
          const dayData = dayMap.get(dayId);
          const hasEntry = !!dayData;
          const hasSummary = dayData?.hasSummary ?? false;
          const isDayToday = isToday(date);
          const isCurrentMonth = isSameMonth(date, currentMonth);

          const linkTo = isDayToday ? '/today' : `/day/${dayId}`;

          return (
            <Link
              key={dayId}
              to={linkTo}
              className={cn(
                "aspect-square flex flex-col items-center justify-center relative rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                hasEntry && "bg-primary/10 hover:bg-primary/20",
                isDayToday && "font-bold ring-2 ring-primary ring-inset",
                !isCurrentMonth && "opacity-40"
              )}
            >
              <span className="text-sm">{format(date, 'd')}</span>
              {hasSummary && <span className="w-1.5 h-1.5 rounded-full bg-primary absolute bottom-1.5" />}
            </Link>
          );
        })}
      </div>

      <div className="flex justify-center gap-6 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-primary/20" /> Has entries
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" /> Has summary
        </span>
      </div>
    </div>
  );
}
