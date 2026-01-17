import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSummaries } from '../hooks/useSummary';
import { useSettings } from '../hooks/useSettings';
import { queryHistory } from '../services/ai/query';
import type { QueryResponse } from '@/types';
import { format, subDays } from 'date-fns';
import './HistoryPage.css';

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
    <div className="history-page">
      <div className="history-header">
        <h2>Query Your Journal History</h2>
        <div className="date-range-selector">
          <label>Date range:</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangePreset)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      <div className="history-status">
        {summariesLoading ? (
          <p>Loading summaries...</p>
        ) : (
          <p>{summaries.length} day{summaries.length !== 1 ? 's' : ''} with summaries available</p>
        )}
      </div>

      {!apiKey && (
        <div className="query-error">
          Please configure your OpenRouter API key in settings to use this feature.
        </div>
      )}

      <div className="query-input">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your journal history (e.g., 'How was my sleep last week?')"
          disabled={isQuerying || summariesLoading || !apiKey}
          rows={2}
        />
        <button
          onClick={handleQuery}
          disabled={!query.trim() || summaries.length === 0 || summariesLoading || isQuerying || !apiKey}
        >
          {isQuerying ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div className="query-error">{error}</div>}

      {result && (
        <div className="query-response">
          <h3>Response</h3>
          <div className="response-content">{result.response}</div>

          {result.citations.length > 0 && (
            <div className="citations">
              <h4>Sources</h4>
              {result.citations.map((citation, idx) => (
                <div key={idx} className="citation">
                  <Link to={"/day/" + citation.date}>{citation.date}</Link>
                  <span className="citation-excerpt">"{citation.excerpt}"</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !isQuerying && summaries.length === 0 && !summariesLoading && (
        <div className="no-summaries">
          <p>No summaries found for the selected date range.</p>
          <p>Generate summaries on past days to enable historical queries.</p>
        </div>
      )}
    </div>
  );
}
