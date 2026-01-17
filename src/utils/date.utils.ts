import { format, parseISO, startOfDay, endOfDay, isToday, isSameDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export function getTodayId(timezone: string = getLocalTimezone()): string {
  const now = new Date();
  const zonedDate = toZonedTime(now, timezone);
  return format(zonedDate, 'yyyy-MM-dd');
}

export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatDayId(dayId: string): string {
  const date = parseISO(dayId);
  return format(date, 'MMMM d, yyyy');
}

export function formatShortDate(dayId: string): string {
  const date = parseISO(dayId);
  return format(date, 'MMM d');
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return format(date, 'h:mm a');
}

export function isValidDayId(dayId: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dayId);
}

export function getDayStartEnd(dayId: string, timezone: string) {
  const date = parseISO(dayId);
  const zonedDate = toZonedTime(date, timezone);

  return {
    start: fromZonedTime(startOfDay(zonedDate), timezone).getTime(),
    end: fromZonedTime(endOfDay(zonedDate), timezone).getTime(),
  };
}

export function isDayToday(dayId: string): boolean {
  const date = parseISO(dayId);
  return isToday(date);
}

export function isSameDayAs(dayId: string, otherDayId: string): boolean {
  const date1 = parseISO(dayId);
  const date2 = parseISO(otherDayId);
  return isSameDay(date1, date2);
}

export function getDaysInRange(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    days.push(format(current, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }

  return days;
}
