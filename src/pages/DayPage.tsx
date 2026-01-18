import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChatInterface } from '../components/chat/ChatInterface';
import { DailySummary } from '../components/summary/DailySummary';
import { useMessages } from '../hooks/useMessages';
import { useSummary } from '../hooks/useSummary';
import { useSettings } from '../hooks/useSettings';
import { useVisibilityChange } from '../hooks/useVisibilityChange';
import { generateSummary, shouldGenerateSummary } from '@/services/summary';
import { formatDayId, isValidDayId, isDayToday } from '../utils/date.utils';
import './DayPage.css';

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
  const [autoGenerating, setAutoGenerating] = useState(false);

  const handleGenerateSummary = useCallback(async () => {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const messagesForSummary = messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));

    const result = await generateSummary(messagesForSummary, dayId, apiKey);
    await saveSummary(result.summary, result.rawContent);
  }, [apiKey, messages, dayId, saveSummary]);

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
    <div className="day-page">
      <div className="day-header">
        <h2>{formatDayId(dayId)}</h2>
        <div className="day-tabs">
          <button
            onClick={() => setViewMode('summary')}
            className={viewMode === 'summary' ? 'active' : ''}
          >
            Summary
          </button>
          <button
            onClick={() => setViewMode('chat')}
            className={viewMode === 'chat' ? 'active' : ''}
          >
            Chat
          </button>
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
