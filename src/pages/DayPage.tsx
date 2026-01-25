import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

import { useParams, Link } from 'react-router-dom';
import { ChatInterface } from '../components/chat/ChatInterface';
import { DailySummary } from '../components/summary/DailySummary';
import { useMessages } from '../hooks/useMessages';
import { useSummary } from '../hooks/useSummary';
import { useSettings } from '../hooks/useSettings';
import { useDatabase } from '../hooks/useDatabase';
import { useVisibilityChange } from '../hooks/useVisibilityChange';
import { generateSummary, shouldGenerateSummary } from '@/services/summary';
import { getSummarizerModel } from '@/services/settings/settings.service';
import { formatDayId, isValidDayId, isDayToday } from '../utils/date.utils';


type ViewMode = 'chat' | 'summary';

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  if (!date || !isValidDayId(date)) {
    return (
      <div className="day-page-error">
        <p>Invalid date format</p>
        <Link to="/calendar">Back to Calendar</Link>
      </div>
    );
  }

  if (isDayToday(date)) {
    return (
      <div className="day-page-error">
        <p>This is today's page</p>
        <Link to="/today">Go to Today</Link>
      </div>
    );
  }

  return <DayPageContent dayId={date} viewMode={viewMode} setViewMode={setViewMode} />;
}

interface DayPageContentProps {
  dayId: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

function DayPageContent({ dayId, viewMode, setViewMode }: DayPageContentProps) {
  const { messages, isLoading: messagesLoading } = useMessages(dayId);
  const { summary, isLoading: summaryLoading, saveSummary } = useSummary(dayId);
  const { apiKey } = useSettings();
  const { db } = useDatabase();
  const [autoGenerating, setAutoGenerating] = useState(false);

  const handleGenerateSummary = useCallback(async () => {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    if (!db) {
      throw new Error('Database not initialized');
    }

    // Get the user's selected summarizer model
    const summarizerModel = await getSummarizerModel(db);

    const result = await generateSummary(messages, dayId, apiKey, summarizerModel);
    await saveSummary(result.summary, result.rawContent);
  }, [apiKey, messages, dayId, saveSummary, db]);

  // Check if we should auto-generate summary
  const checkAndGenerateSummary = useCallback(async () => {
    if (!apiKey || autoGenerating) return;

    const shouldGenerate = shouldGenerateSummary(
      dayId,
      !!summary,
      messages.length > 0
    );

    if (shouldGenerate) {
      setAutoGenerating(true);
      try {
        await handleGenerateSummary();
      } catch {
        // Silently fail for auto-generation
      } finally {
        setAutoGenerating(false);
      }
    }
  }, [apiKey, autoGenerating, dayId, summary, messages.length, handleGenerateSummary]);

  // Auto-generate summary when returning to app
  useVisibilityChange({
    onVisible: checkAndGenerateSummary,
  });

  // Also check on initial load
  useEffect(() => {
    if (!messagesLoading && !summaryLoading && messages.length > 0 && !summary && apiKey) {
      checkAndGenerateSummary();
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b bg-muted/30">
        <h2 className="text-base font-medium text-muted-foreground m-0">{formatDayId(dayId)}</h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'summary' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('summary')}
          >
            Summary
          </Button>
          <Button
            variant={viewMode === 'chat' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('chat')}
          >
            Chat
          </Button>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <DailySummary
          dayId={dayId}
          summary={summary}
          messages={messages}
          onGenerateSummary={handleGenerateSummary}
          isLoading={summaryLoading || messagesLoading || autoGenerating}
        />
      ) : (
        <ChatInterface dayId={dayId} />
      )}
    </div>
  );
}
