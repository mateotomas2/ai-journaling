import { describe, it, expect } from 'vitest';
import {
  getTodayId,
  getLocalTimezone,
  formatDayId,
  formatShortDate,
  formatTime,
  isValidDayId,
  isDayToday,
  getDaysInRange,
} from '../../src/utils/date.utils';

describe('date.utils', () => {
  describe('getTodayId', () => {
    it('returns date in YYYY-MM-DD format', () => {
      const todayId = getTodayId();
      expect(todayId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getLocalTimezone', () => {
    it('returns a timezone string', () => {
      const tz = getLocalTimezone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe('formatDayId', () => {
    it('formats day ID to readable string', () => {
      const formatted = formatDayId('2026-01-16');
      expect(formatted).toBe('January 16, 2026');
    });
  });

  describe('formatShortDate', () => {
    it('formats day ID to short string', () => {
      const formatted = formatShortDate('2026-01-16');
      expect(formatted).toBe('Jan 16');
    });
  });

  describe('formatTime', () => {
    it('formats timestamp to time string', () => {
      // Create a specific time
      const timestamp = new Date('2026-01-16T14:30:00').getTime();
      const formatted = formatTime(timestamp);
      expect(formatted).toMatch(/\d{1,2}:\d{2} [AP]M/);
    });
  });

  describe('isValidDayId', () => {
    it('returns true for valid day ID', () => {
      expect(isValidDayId('2026-01-16')).toBe(true);
    });

    it('returns false for invalid formats', () => {
      expect(isValidDayId('2026-1-16')).toBe(false);
      expect(isValidDayId('01-16-2026')).toBe(false);
      expect(isValidDayId('invalid')).toBe(false);
    });
  });

  describe('isDayToday', () => {
    it('returns true for today', () => {
      const todayId = getTodayId();
      expect(isDayToday(todayId)).toBe(true);
    });

    it('returns false for other days', () => {
      expect(isDayToday('2020-01-01')).toBe(false);
    });
  });

  describe('getDaysInRange', () => {
    it('returns array of day IDs in range', () => {
      const days = getDaysInRange('2026-01-14', '2026-01-16');
      expect(days).toEqual(['2026-01-14', '2026-01-15', '2026-01-16']);
    });

    it('returns single day for same start and end', () => {
      const days = getDaysInRange('2026-01-16', '2026-01-16');
      expect(days).toEqual(['2026-01-16']);
    });
  });
});
