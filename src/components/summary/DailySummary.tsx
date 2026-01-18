import { useState } from 'react';
import type { Summary, Message } from '../../types/entities';
import { SummarySection } from './SummarySection';
import { formatDayId } from '../../utils/date.utils';
import './DailySummary.css';

interface DailySummaryProps {
  dayId: string;
  summary: Summary | null;
  messages: Message[];
  onGenerateSummary: () => Promise<void>;
  isLoading?: boolean;
}

export function DailySummary({
  dayId,
  summary,
  messages,
  onGenerateSummary,
  isLoading,
}: DailySummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      await onGenerateSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = messages.length > 0 && !isGenerating && !isLoading;

  if (isLoading) {
    return <div className="daily-summary loading">Loading summary...</div>;
  }

  return (
    <div className="daily-summary">
      <div className="summary-header">
        <h3>Summary for {formatDayId(dayId)}</h3>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={isGenerating ? 'generating' : ''}
        >
          {isGenerating ? 'Generating...' : summary ? 'Regenerate' : 'Generate Summary'}
        </button>
      </div>

      {error && <div className="summary-error">{error}</div>}

      {summary ? (
        <div className="summary-content">
          <SummarySection title="Journal" content={summary.sections.journal} />
          <SummarySection title="Insights" content={summary.sections.insights} />
          <SummarySection title="Health" content={summary.sections.health} />
          <SummarySection title="Dreams" content={summary.sections.dreams} />
          <p className="summary-generated-at">
            Generated: {new Date(summary.generatedAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="summary-empty">
          {messages.length === 0 ? (
            <p>No journal entries yet. Start chatting to create entries!</p>
          ) : (
            <p>Click "Generate Summary" to create an AI summary of your day.</p>
          )}
        </div>
      )}
    </div>
  );
}
