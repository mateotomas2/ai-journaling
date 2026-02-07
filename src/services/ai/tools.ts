/**
 * AI Tool Definitions
 * Defines tools/functions that the LLM can call during chat
 */

import type { Tool, ToolCall, ToolResult } from '@/types';
import { memoryService } from '@/services/memory/search';

/**
 * Memory search tool - allows LLM to search past journal entries and notes
 */
export const MEMORY_SEARCH_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'search_journal_memory',
    description:
      'Search past journal entries and notes using semantic similarity. Use this when the user asks about past experiences, wants to recall something they wrote before, or when you need context from their journal history.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant past entries',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
        minScore: {
          type: 'number',
          description: 'Minimum similarity score from 0 to 1 (default: 0.3)',
        },
        dateRange: {
          type: 'object',
          description: 'Optional date range filter',
          properties: {
            startDaysAgo: {
              type: 'number',
              description: 'Start of range as days ago from today',
            },
            endDaysAgo: {
              type: 'number',
              description: 'End of range as days ago from today (0 = today)',
            },
          },
        },
      },
      required: ['query'],
    },
  },
};

/**
 * All available tools for journal chat
 */
export const JOURNAL_TOOLS: Tool[] = [MEMORY_SEARCH_TOOL];

/**
 * Arguments for the memory search tool
 */
interface MemorySearchArgs {
  query: string;
  limit?: number;
  minScore?: number;
  dateRange?: {
    startDaysAgo?: number;
    endDaysAgo?: number;
  };
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolCall: ToolCall,
  currentDayId: string
): Promise<ToolResult> {
  const { name, arguments: argsString } = toolCall.function;

  try {
    if (name === 'search_journal_memory') {
      let args = JSON.parse(argsString) as MemorySearchArgs;
      console.log('Memory search args:', args);

      if (args.dateRange?.startDaysAgo === undefined && args.dateRange?.endDaysAgo === undefined) {
        args.dateRange = {
          startDaysAgo: 7,
          endDaysAgo: 0,
        };
      }
      return await executeMemorySearch(toolCall.id, args, currentDayId);
    }

    return {
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        error: `Unknown tool: ${name}`,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        error: `Tool execution failed: ${message}`,
      }),
    };
  }
}

/**
 * Execute the memory search tool
 */
async function executeMemorySearch(
  toolCallId: string,
  args: MemorySearchArgs,
  currentDayId: string
): Promise<ToolResult> {
  const { query, limit = 5, minScore = 0.3, dateRange } = args;

  // Build date range filter if provided
  let dateRangeFilter: { start?: number; end?: number } | undefined;
  if (dateRange) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    if (dateRange.startDaysAgo !== undefined) {
      dateRangeFilter = dateRangeFilter || {};
      dateRangeFilter.start = now - dateRange.startDaysAgo * dayMs;
    }
    if (dateRange.endDaysAgo !== undefined) {
      dateRangeFilter = dateRangeFilter || {};
      dateRangeFilter.end = now - dateRange.endDaysAgo * dayMs;
    }
  }

  // Execute the search - only include dateRange if we have filter values
  const results = await memoryService.search(
    dateRangeFilter
      ? {
        query,
        limit: limit + 1, // Get one extra to filter out current day
        minScore,
        dateRange: dateRangeFilter,
      }
      : {
        query,
        limit: limit + 1,
        minScore,
      }
  );

  console.log('Memory search results:', results);

  // Filter out results from the current day to avoid returning current conversation
  const filteredResults = results.filter((r) => r.dayId !== currentDayId);

  // Take up to limit results after filtering
  const finalResults = filteredResults.slice(0, limit);

  if (finalResults.length === 0) {
    return {
      tool_call_id: toolCallId,
      content: JSON.stringify({
        status: 'no_results',
        message: 'No matching entries found in journal history.',
        query,
      }),
    };
  }

  // Format results for the LLM
  const formattedResults = finalResults.map((result) => {
    if (result.entityType === 'note') {
      return {
        type: 'note',
        date: result.dayId,
        category: result.note.category,
        title: result.note.title || null,
        excerpt: result.excerpt,
        content: result.note.content,
        score: Math.round(result.score * 100) / 100,
      };
    } else {
      return {
        type: 'message',
        date: result.dayId,
        role: result.message.role,
        excerpt: result.excerpt,
        content: result.message.content,
        score: Math.round(result.score * 100) / 100,
      };
    }
  });

  return {
    tool_call_id: toolCallId,
    content: JSON.stringify({
      status: 'success',
      query,
      resultCount: formattedResults.length,
      results: formattedResults,
    }),
  };
}
