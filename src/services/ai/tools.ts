/**
 * AI Tool Definitions
 * Defines tools/functions that the LLM can call during chat
 */

import type { Tool, ToolCall, ToolResult } from '@/types';
import { memoryService } from '@/services/memory/search';
import { getTodayId } from '@/utils/date.utils';
import { format, subDays, parseISO } from 'date-fns';

/**
 * Memory search tool - allows LLM to search past journal entries and notes
 */
export const MEMORY_SEARCH_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'search_journal_memory',
    description:
      'Search journal entries and notes using semantic similarity. Use this when you need context from their journal history. Use this when the user asks for anything that you have no information about.',
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
          description: 'Optional date range filter using YYYY-MM-DD format',
          properties: {
            startDate: {
              type: 'string',
              description: 'Earliest date to include (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'Latest date to include (YYYY-MM-DD)',
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
    startDate?: string;
    endDate?: string;
  };
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolCall: ToolCall,
  conversationMessageIds: string[]
): Promise<ToolResult> {
  const { name, arguments: argsString } = toolCall.function;

  try {
    if (name === 'search_journal_memory') {
      let args = JSON.parse(argsString) as MemorySearchArgs;
      console.log('Memory search args:', args);

      if (args.dateRange?.startDate === undefined && args.dateRange?.endDate === undefined) {
        const today = getTodayId();
        const weekAgo = format(subDays(parseISO(today), 7), 'yyyy-MM-dd');
        args.dateRange = {
          startDate: weekAgo,
          endDate: today,
        };
      }
      return await executeMemorySearch(toolCall.id, args, conversationMessageIds);
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
  conversationMessageIds: string[]
): Promise<ToolResult> {
  const { query, limit = 5, minScore = 0.3, dateRange } = args;

  // Execute the search - pass date range as dayId strings directly
  const excludeCount = conversationMessageIds.length;
  const results = await memoryService.search({
    query,
    limit: limit + excludeCount,
    minScore,
    ...(dateRange && { dateRange }),
  });

  // Filter out messages already in the current conversation context
  const excludeSet = new Set(conversationMessageIds);
  const filteredResults = results.filter(
    (r) => !(r.entityType === 'message' && excludeSet.has(r.entityId))
  );

  // Take up to limit results after filtering
  const finalResults = filteredResults.slice(0, limit);

  console.log("finalResults", finalResults)
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
