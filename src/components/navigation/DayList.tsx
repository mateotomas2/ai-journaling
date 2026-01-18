import { Link } from 'react-router-dom';
import type { Day } from '../../types/entities';
import { formatDayId, isDayToday } from '../../utils/date.utils';
import './DayList.css';

interface DayListProps {
  days: Day[];
  isLoading?: boolean;
}

export function DayList({ days, isLoading }: DayListProps) {
  if (isLoading) {
    return <div className="day-list loading">Loading days...</div>;
  }

  if (days.length === 0) {
    return (
      <div className="day-list empty">
        <p>No journal entries yet.</p>
        <Link to="/today">Start journaling today</Link>
      </div>
    );
  }

  return (
    <div className="day-list">
      {days.map((day) => {
        const linkTo = isDayToday(day.id) ? '/today' : `/day/${day.id}`;

        return (
          <Link key={day.id} to={linkTo} className="day-list-item">
            <div className="day-info">
              <span className="day-date">{formatDayId(day.id)}</span>
              {isDayToday(day.id) && <span className="today-badge">Today</span>}
            </div>
            <div className="day-meta">
              {day.hasSummary && <span className="summary-badge">Summary</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
