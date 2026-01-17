import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import type { Summary, SummarySections } from '../types/entities';

export function useSummary(dayId: string) {
  const { db } = useDatabase();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    const subscription = db.summaries
      .findOne({ selector: { dayId } })
      .$.subscribe((doc) => {
        setSummary(doc ? doc.toJSON() : null);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [db, dayId]);

  const saveSummary = useCallback(
    async (sections: SummarySections, rawContent: string): Promise<Summary> => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const existingSummary = await db.summaries
        .findOne({ selector: { dayId } })
        .exec();

      if (existingSummary) {
        await existingSummary.patch({
          sections,
          rawContent,
          generatedAt: Date.now(),
        });
        return existingSummary.toJSON();
      }

      const newSummary: Summary = {
        id: dayId,
        dayId,
        generatedAt: Date.now(),
        sections,
        rawContent,
      };

      await db.summaries.insert(newSummary);

      // Update day's hasSummary flag
      const dayDoc = await db.days.findOne({ selector: { id: dayId } }).exec();
      if (dayDoc) {
        await dayDoc.patch({ hasSummary: true });
      }

      return newSummary;
    },
    [db, dayId]
  );

  return {
    summary,
    isLoading,
    saveSummary,
  };
}

export function useSummaries(startDate?: string, endDate?: string) {
  const { db } = useDatabase();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    const selector: Record<string, unknown> = {};

    if (startDate && endDate) {
      selector.dayId = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const subscription = db.summaries
      .find({
        selector,
        sort: [{ dayId: 'desc' }],
      })
      .$.subscribe((docs) => {
        setSummaries(docs.map((doc) => doc.toJSON()));
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [db, startDate, endDate]);

  return { summaries, isLoading };
}
