/**
 * MemorySearch Component
 * Modal search dialog for searching journal memories with natural language
 */

import { useState, useEffect } from 'react';
import { useMemorySearch } from '../../hooks/useMemorySearch';
import { SearchResults } from './SearchResults';
import { memoryService } from '../../services/memory/search';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Command,
  CommandInput,
} from '../ui/command';
import { Button } from '../ui/button';
import { Search, X, Clock, TrendingUp } from 'lucide-react';

export interface MemorySearchProps {
  /** Whether the search dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when a result is selected (optional) */
  onResultSelect?: (messageId: string, dayId: string) => void;
}

/**
 * Search dialog for finding journal entries using natural language
 */
export function MemorySearch({
  open,
  onOpenChange,
  onResultSelect,
}: MemorySearchProps) {
  const { query, results, isLoading, error, hasSearched, search, clear } =
    useMemorySearch();
  const [localQuery, setLocalQuery] = useState('');
  const [themeSummary, setThemeSummary] = useState<string[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);

  // Load recurring themes when dialog opens
  useEffect(() => {
    if (open && themeSummary.length === 0) {
      setLoadingThemes(true);
      memoryService
        .analyzeRecurringThemes({ minFrequency: 3, maxThemes: 8 })
        .then((analysis) => {
          setThemeSummary(analysis.summary);
        })
        .catch((err) => {
          console.error('[MemorySearch] Failed to load themes:', err);
        })
        .finally(() => {
          setLoadingThemes(false);
        });
    }
  }, [open, themeSummary.length]);

  // Clear search when dialog closes
  useEffect(() => {
    if (!open) {
      setLocalQuery('');
      clear();
    }
  }, [open, clear]);

  const handleSearch = async () => {
    if (localQuery.trim()) {
      await search(localQuery.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Search Your Journal
          </DialogTitle>
          <DialogDescription>
            Search your journal entries using natural language. Find entries by topic,
            emotion, or any concept.
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-6 pt-4">
          <Command className="rounded-lg border">
            <CommandInput
              placeholder="Search for memories... (e.g., 'times I felt proud')"
              value={localQuery}
              onValueChange={setLocalQuery}
              onKeyDown={handleKeyDown}
            />
          </Command>

          {/* Search Button */}
          <div className="mt-3 flex items-center gap-2">
            <Button
              onClick={handleSearch}
              disabled={!localQuery.trim() || isLoading}
              className="flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {isLoading ? 'Searching...' : 'Search'}
            </Button>

            {hasSearched && (
              <Button
                variant="outline"
                onClick={() => {
                  setLocalQuery('');
                  clear();
                }}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {/* Topics I Write About */}
          {!hasSearched && themeSummary.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Topics I Write About
              </h3>
              <div className="flex flex-wrap gap-2">
                {themeSummary.map((theme, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-sm py-1.5 px-3 cursor-pointer hover:bg-secondary/80 transition-colors"
                    onClick={() => {
                      // Extract topic name (remove frequency count)
                      const topicMatch = theme.match(/^(.+?)\s*\(/);
                      const topic = topicMatch ? topicMatch[1]?.trim() : theme;
                      if (topic) {
                        setLocalQuery(topic);
                      }
                    }}
                  >
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {loadingThemes && !hasSearched && (
            <div className="text-sm text-muted-foreground mb-4">
              Loading your topics...
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              <strong>Error:</strong> {error.message}
            </div>
          )}

          {hasSearched && !error && (
            <>
              {/* Results Summary */}
              <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Searching your journal...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      <span>
                        {results.length} {results.length === 1 ? 'result' : 'results'}{' '}
                        found
                        {query && (
                          <>
                            {' '}
                            for <span className="font-medium">"{query}"</span>
                          </>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Search Results */}
              <SearchResults
                results={results}
                isLoading={isLoading}
                query={query}
                onResultClick={(result) => {
                  onResultSelect?.(result.message.id, result.message.dayId);
                  onOpenChange(false);
                }}
              />
            </>
          )}

          {!hasSearched && !error && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                Enter a search query to find relevant journal entries
              </p>
              <p className="text-xs mt-2">
                Try searching for topics, emotions, or specific events
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
