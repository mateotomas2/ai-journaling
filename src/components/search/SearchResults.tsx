/**
 * SearchResults Component
 * Displays ranked memory search results with dates, excerpts, and relevance scores
 */

import type { MemorySearchResult } from '../../../specs/006-vector-memory/contracts/memory-service';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { formatDayId, formatShortDate } from '../../utils/date.utils';
import { cn } from '@/lib/utils';
import { Calendar, Hash, TrendingUp } from 'lucide-react';

export interface SearchResultsProps {
  /** Search results to display */
  results: MemorySearchResult[];
  /** Whether search is loading */
  isLoading?: boolean;
  /** Search query for highlighting */
  query?: string;
  /** Callback when a result is clicked */
  onResultClick?: (result: MemorySearchResult) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Displays a list of memory search results
 */
export function SearchResults({
  results,
  isLoading = false,
  query,
  onResultClick,
  className,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-muted rounded w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-5/6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="text-muted-foreground text-sm">
          {query ? (
            <>
              No results found for <span className="font-medium">"{query}"</span>
            </>
          ) : (
            'Enter a search query to find relevant journal entries'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {results.map((result) => (
        <Card
          key={result.message.id}
          className={cn(
            'transition-all hover:shadow-md border-l-4',
            getRelevanceBorderColor(result.score),
            onResultClick && 'cursor-pointer'
          )}
          onClick={() => onResultClick?.(result)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              {/* Date and Rank */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">
                    {formatShortDate(result.message.dayId)}
                  </span>
                </div>
                {result.rank && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Hash className="w-3 h-3" />
                    <span>{result.rank}</span>
                  </div>
                )}
              </div>

              {/* Relevance Badge */}
              <Badge
                variant={getRelevanceBadgeVariant(result.score)}
                className="text-xs flex items-center gap-1"
              >
                <TrendingUp className="w-3 h-3" />
                {(result.score * 100).toFixed(0)}%
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-2">
            {/* Excerpt */}
            <div className="text-sm leading-relaxed text-card-foreground">
              {result.excerpt || result.message.content}
            </div>

            {/* Full Date */}
            <div className="text-xs text-muted-foreground/60">
              {formatDayId(result.message.dayId)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Get badge variant based on relevance score
 */
function getRelevanceBadgeVariant(
  score: number
): 'default' | 'secondary' | 'outline' {
  if (score > 0.7) {
    return 'default'; // High relevance
  } else if (score > 0.5) {
    return 'secondary'; // Medium relevance
  } else {
    return 'outline'; // Low relevance
  }
}

/**
 * Get border color class based on relevance score
 */
function getRelevanceBorderColor(score: number): string {
  if (score > 0.7) {
    return 'border-l-primary'; // High relevance
  } else if (score > 0.5) {
    return 'border-l-secondary'; // Medium relevance
  } else {
    return 'border-l-muted'; // Low relevance
  }
}
