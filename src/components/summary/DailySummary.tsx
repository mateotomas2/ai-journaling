import { useState } from 'react';
import type { Summary, Message } from '../../types/entities';
import { SummarySection } from './SummarySection';
import { formatDayId } from '../../utils/date.utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

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
    return (
      <div className="flex justify-center items-center h-[200px] text-muted-foreground">
        Loading summary...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold m-0">Summary for {formatDayId(dayId)}</h3>
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          size="sm"
          className={isGenerating ? 'opacity-70 cursor-wait' : ''}
        >
          {isGenerating ? 'Generating...' : summary ? 'Regenerate' : 'Generate Summary'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {summary ? (
        <Card>
          <CardContent className="p-6 space-y-6">
            <SummarySection title="Journal" content={summary.sections.journal} />
            <SummarySection title="Insights" content={summary.sections.insights} />
            <SummarySection title="Health" content={summary.sections.health} />
            <SummarySection title="Dreams" content={summary.sections.dreams} />
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
              Generated: {new Date(summary.generatedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center p-8 text-muted-foreground">
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
