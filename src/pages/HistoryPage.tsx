import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSummaries } from '../hooks/useSummary';
import { useSettings } from '../hooks/useSettings';
import { queryHistory } from '../services/ai/query';
import type { QueryResponse } from '@/types';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, History } from 'lucide-react';

type DateRangePreset = '7d' | '30d' | '90d' | 'all';

export function HistoryPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangePreset>('30d');
  const { apiKey } = useSettings();

  const getDateRange = useCallback(() => {
    if (dateRange === 'all') return undefined;

    const today = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;

    return {
      start: format(subDays(today, days), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    };
  }, [dateRange]);

  const range = getDateRange();
  const { summaries, isLoading: summariesLoading } = useSummaries(range?.start, range?.end);

  const handleQuery = useCallback(async () => {
    if (!query.trim() || isQuerying || summaries.length === 0 || !apiKey) return;

    setIsQuerying(true);
    setError(null);
    setResult(null);

    try {
      const summariesForQuery = summaries.map((s) => ({
        date: s.dayId,
        rawContent: s.rawContent,
      }));

      const response = await queryHistory(query, summariesForQuery, apiKey);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsQuerying(false);
    }
  }, [query, isQuerying, summaries, apiKey]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight m-0">Query Your History</h2>
            <p className="text-sm text-muted-foreground m-0">Ask questions about your journal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Date range:</span>
          <Select value={dateRange} onValueChange={(val) => setDateRange(val as DateRangePreset)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6 text-sm text-muted-foreground">
        {summariesLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading summaries...
          </div>
        ) : (
          <p>{summaries.length} day{summaries.length !== 1 ? 's' : ''} with summaries available</p>
        )}
      </div>

      {!apiKey && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-6 text-sm">
          Please configure your OpenRouter API key in settings to use this feature.
        </div>
      )}

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your journal history (e.g., 'How was my sleep last week?')"
            disabled={isQuerying || summariesLoading || !apiKey}
            className="min-h-[80px] pr-24 resize-none"
          />
          <div className="absolute bottom-3 right-3">
            <Button
              onClick={handleQuery}
              disabled={!query.trim() || summaries.length === 0 || summariesLoading || isQuerying || !apiKey}
              size="sm"
            >
              {isQuerying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              {isQuerying ? 'Searching' : 'Search'}
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-6">{error}</div>}

      {result && (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap leading-relaxed text-sm">
              {result.response}
            </div>

            {result.citations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">Sources</h4>
                <div className="space-y-3">
                  {result.citations.map((citation, idx) => (
                    <div key={idx} className="bg-background p-3 rounded-md border border-border text-sm">
                      <Link
                        to={"/day/" + citation.date}
                        className="text-primary hover:underline font-medium block mb-1"
                      >
                        {citation.date}
                      </Link>
                      <span className="text-muted-foreground italic">"{citation.excerpt}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!result && !isQuerying && summaries.length === 0 && !summariesLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-2">No summaries found for the selected date range.</p>
          <p className="text-sm">Generate summaries on past days to enable historical queries.</p>
        </div>
      )}
    </div>
  );
}
