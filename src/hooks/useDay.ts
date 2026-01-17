import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import type { Day } from '../types/entities';

export function useDay(dayId: string) {
  const { db } = useDatabase();
  const [day, setDay] = useState<Day | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    const subscription = db.days
      .findOne({ selector: { id: dayId } })
      .$.subscribe((doc) => {
        setDay(doc ? doc.toJSON() : null);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [db, dayId]);

  const createOrUpdateDay = useCallback(
    async (timezone: string): Promise<Day> => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const now = Date.now();
      const existingDay = await db.days.findOne({ selector: { id: dayId } }).exec();

      if (existingDay) {
        await existingDay.patch({ updatedAt: now });
        return existingDay.toJSON();
      }

      const newDay: Day = {
        id: dayId,
        createdAt: now,
        updatedAt: now,
        timezone,
        hasSummary: false,
      };

      await db.days.insert(newDay);
      return newDay;
    },
    [db, dayId]
  );

  const updateHasSummary = useCallback(
    async (hasSummary: boolean) => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const dayDoc = await db.days.findOne({ selector: { id: dayId } }).exec();
      if (dayDoc) {
        await dayDoc.patch({ hasSummary });
      }
    },
    [db, dayId]
  );

  return {
    day,
    isLoading,
    createOrUpdateDay,
    updateHasSummary,
  };
}

export function useDays() {
  const { db } = useDatabase();
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    const subscription = db.days
      .find({
        sort: [{ createdAt: 'desc' }],
      })
      .$.subscribe((docs) => {
        setDays(docs.map((doc) => doc.toJSON()));
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [db]);

  return { days, isLoading };
}
