import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { isDayToday } from '../../utils/date.utils';
import './DaySelector.css';

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
    <div className="day-selector">
      <button onClick={goToPrevious} title="Previous day">
        &lt;
      </button>
      <button onClick={goToToday} className="today-button">
        Today
      </button>
      <button onClick={goToNext} disabled={isTodayOrFuture} title="Next day">
        &gt;
      </button>
    </div>
  );
}
