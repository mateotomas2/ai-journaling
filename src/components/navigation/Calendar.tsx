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
import './Calendar.css';

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
    <div className="calendar">
      <div className="calendar-header">
        <button onClick={() => onMonthChange(subMonths(currentMonth, 1))}>&lt;</button>
        <h3>{format(currentMonth, 'MMMM yyyy')}</h3>
        <button onClick={() => onMonthChange(addMonths(currentMonth, 1))}>&gt;</button>
      </div>

      <div className="calendar-weekdays">
        {weekDays.map((day) => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="calendar-day empty" />;
          }

          const dayId = format(date, 'yyyy-MM-dd');
          const dayData = dayMap.get(dayId);
          const hasEntry = !!dayData;
          const hasSummary = dayData?.hasSummary ?? false;
          const isDayToday = isToday(date);
          const isCurrentMonth = isSameMonth(date, currentMonth);

          const classNames = [
            'calendar-day',
            hasEntry ? 'has-entry' : '',
            hasSummary ? 'has-summary' : '',
            isDayToday ? 'today' : '',
            !isCurrentMonth ? 'other-month' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const linkTo = isDayToday ? '/today' : `/day/${dayId}`;

          return (
            <Link key={dayId} to={linkTo} className={classNames}>
              <span className="day-number">{format(date, 'd')}</span>
              {hasSummary && <span className="summary-indicator" />}
            </Link>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span className="legend-item">
          <span className="legend-dot has-entry" /> Has entries
        </span>
        <span className="legend-item">
          <span className="legend-dot has-summary" /> Has summary
        </span>
      </div>
    </div>
  );
}
