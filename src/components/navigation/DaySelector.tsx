import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { isDayToday } from '../../utils/date.utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DaySelectorProps {
  currentDayId: string;
}

export function DaySelector({ currentDayId }: DaySelectorProps) {
  const navigate = useNavigate();
  const currentDate = parseISO(currentDayId);

  const goToPrevious = () => {
    const prevDate = subDays(currentDate, 1);
    const prevDayId = format(prevDate, 'yyyy-MM-dd');
    navigate(`/day/${prevDayId}`);
  };

  const goToNext = () => {
    const nextDate = addDays(currentDate, 1);
    const nextDayId = format(nextDate, 'yyyy-MM-dd');

    if (isDayToday(nextDayId)) {
      navigate('/today');
    } else {
      navigate(`/day/${nextDayId}`);
    }
  };

  const goToToday = () => {
    navigate('/today');
  };

  const isTodayOrFuture = isDayToday(currentDayId) ||
    currentDate > new Date();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={goToPrevious} title="Previous day">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant={isDayToday(currentDayId) ? "default" : "outline"}
        onClick={goToToday}
        className="min-w-[80px]"
      >
        Today
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={goToNext}
        disabled={isTodayOrFuture}
        title="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
