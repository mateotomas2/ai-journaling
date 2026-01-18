import { useState } from 'react';
import { Calendar } from '../components/navigation/Calendar';
import { DayList } from '../components/navigation/DayList';
import { useDays } from '../hooks/useDay';
import './CalendarPage.css';

type ViewMode = 'calendar' | 'list';

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { days, isLoading } = useDays();

  return (
    <div className="calendar-page">
      <div className="calendar-page-header">
        <h2>Your Journal</h2>
        <div className="view-toggle">
          <button
            onClick={() => setViewMode('calendar')}
            className={viewMode === 'calendar' ? 'active' : ''}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'active' : ''}
          >
            List
          </button>
        </div>
      </div>

      <div className="calendar-page-content">
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
