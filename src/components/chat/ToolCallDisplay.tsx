import { useState } from 'react';
import type { ToolCallPart, ToolResultPart } from '@tanstack/ai';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_journal_memory: 'Memory Search',
};

interface ToolCallDisplayProps {
  toolCall: ToolCallPart;
  toolResult?: ToolResultPart | undefined;
}

export function ToolCallDisplay({ toolCall, toolResult }: ToolCallDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);

  const displayName = TOOL_DISPLAY_NAMES[toolCall.name] || toolCall.name;
  const isComplete = toolCall.state === 'input-complete' || toolCall.state === 'approval-responded';
  const isStreaming = toolCall.state === 'awaiting-input' || toolCall.state === 'input-streaming';
  const hasResult = toolResult && toolResult.state === 'complete';
  const hasError = toolResult && toolResult.state === 'error';

  let args: Record<string, string | number | boolean | object | null> | null = null;
  try {
    args = toolCall.arguments ? JSON.parse(toolCall.arguments) : null;
  } catch {
    // args still streaming
  }

  let resultData: { status?: string; resultCount?: number; results?: Array<Record<string, string | number | null>>; query?: string; message?: string } | null = null;
  if (toolResult?.content) {
    try {
      resultData = JSON.parse(toolResult.content);
    } catch {
      // ignore
    }
  }

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-foreground">{displayName}</span>
        {args?.query && (
          <span className="text-muted-foreground truncate">
            &quot;{String(args.query)}&quot;
          </span>
        )}
        <span className="ml-auto flex-shrink-0">
          {isStreaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {(isComplete || hasResult) && !hasError && (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          )}
          {hasError && <XCircle className="w-3.5 h-3.5 text-destructive" />}
        </span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          {/* Arguments */}
          {args && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Arguments</div>
              <div className="text-xs bg-background rounded p-2 font-mono">
                {Object.entries(args).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span>{typeof value === 'object' ? JSON.stringify(value) : String(value as string | number | boolean)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {resultData && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Results
                {resultData.resultCount !== undefined && (
                  <span className="ml-1">({resultData.resultCount} found)</span>
                )}
              </div>
              {resultData.status === 'no_results' && (
                <div className="text-xs text-muted-foreground italic">
                  {resultData.message || 'No matching entries found.'}
                </div>
              )}
              {resultData.results && resultData.results.length > 0 && (
                <div className="space-y-1.5">
                  {resultData.results.map((result, i) => (
                    <div
                      key={i}
                      className="text-xs bg-background rounded p-2 border border-border/50"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          result.type === 'note'
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        )}>
                          {String(result.type)}
                        </span>
                        <span className="text-muted-foreground">{String(result.date)}</span>
                        {result.category && (
                          <span className="text-muted-foreground">· {String(result.category)}</span>
                        )}
                      </div>
                      <div className="text-foreground/80 line-clamp-2">
                        {String((result.excerpt ?? result.content ?? '') as string)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {hasError && toolResult.error && (
            <div className="text-xs text-destructive">
              Error: {toolResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
