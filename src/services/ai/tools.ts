/**
 * AI Tool Definitions
 * Defines tools/functions that the LLM can call during chat
 */

import type { Tool, ToolCall, ToolResult } from '@/types';
import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
import { memoryService } from '@/services/memory/search';
import { getTodayId } from '@/utils/date.utils';
import { format, subDays, parseISO } from 'date-fns';
import type { JournalDatabase } from '@/db';
import { getNotesForDay, createNote, updateNote, deleteNote } from '@/services/db/notes';

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
 * Read notes tool - allows LLM to read notes for a journal day
 */
export const READ_NOTES_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'read_notes',
    description: 'Read notes for a journal day. Use when the user asks to see their notes.',
    parameters: {
      type: 'object',
      properties: {
        dayId: {
          type: 'string',
          description: 'The journal day to read notes from (YYYY-MM-DD). Defaults to current journal day if omitted.',
        },
      },
      required: [],
    },
  },
};

/**
 * Write note tool - allows LLM to create or update a note for a journal day
 */
export const WRITE_NOTE_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'write_note',
    description: 'Create or update a note for a journal day. Always call read_notes first to check what already exists.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'The category of the note (e.g. health, work, dreams)',
        },
        content: {
          type: 'string',
          description: 'The content of the note',
        },
        title: {
          type: 'string',
          description: 'Optional title for the note',
        },
        noteId: {
          type: 'string',
          description: 'The ID of an existing note to update. Omit to create a new note.',
        },
        dayId: {
          type: 'string',
          description: 'The journal day to write the note for (YYYY-MM-DD). Defaults to current journal day if omitted.',
        },
      },
      required: ['category', 'content'],
    },
  },
};

/**
 * Delete note tool - allows LLM to delete a note by ID
 */
export const DELETE_NOTE_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'delete_note',
    description: 'Delete a note by its ID. Always call read_notes first to get the noteId.',
    parameters: {
      type: 'object',
      properties: {
        noteId: {
          type: 'string',
          description: 'The ID of the note to delete',
        },
      },
      required: ['noteId'],
    },
  },
};

/**
 * All available tools for journal chat
 */
export const JOURNAL_TOOLS: Tool[] = [MEMORY_SEARCH_TOOL, READ_NOTES_TOOL, WRITE_NOTE_TOOL, DELETE_NOTE_TOOL];

/**
 * Arguments for the memory search tool
 */
interface MemorySearchArgs {
  query: string;
  limit?: number | undefined;
  minScore?: number | undefined;
  dateRange?: {
    startDate?: string | undefined;
    endDate?: string | undefined;
  } | undefined;
}

/**
 * Arguments for the read_notes tool
 */
interface ReadNotesArgs {
  dayId?: string | undefined;
}

/**
 * Arguments for the write_note tool
 */
interface WriteNoteArgs {
  category: string;
  content: string;
  title?: string | undefined;
  noteId?: string | undefined;
  dayId?: string | undefined;
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolCall: ToolCall,
  conversationMessageIds: string[],
  db: JournalDatabase | null,
  currentDayId: string,
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

    if (name === 'read_notes') {
      const args = JSON.parse(argsString) as ReadNotesArgs;
      return await executeReadNotes(toolCall.id, args, db, currentDayId);
    }

    if (name === 'write_note') {
      const args = JSON.parse(argsString) as WriteNoteArgs;
      return await executeWriteNote(toolCall.id, args, db, currentDayId);
    }

    if (name === 'delete_note') {
      const args = JSON.parse(argsString) as { noteId: string };
      return await executeDeleteNote(toolCall.id, args, db);
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
 * Execute the read_notes tool
 */
async function executeReadNotes(
  toolCallId: string,
  args: ReadNotesArgs,
  db: JournalDatabase | null,
  currentDayId: string,
): Promise<ToolResult> {
  if (!db) {
    return {
      tool_call_id: toolCallId,
      content: JSON.stringify({ error: 'Database not available' }),
    };
  }

  const dayId = args.dayId ?? currentDayId;
  const notes = await getNotesForDay(db, dayId);

  return {
    tool_call_id: toolCallId,
    content: JSON.stringify({
      status: 'success',
      dayId,
      noteCount: notes.length,
      notes: notes.map((n) => ({ id: n.id, category: n.category, title: n.title ?? null, content: n.content })),
    }),
  };
}

/**
 * Execute the write_note tool
 */
async function executeWriteNote(
  toolCallId: string,
  args: WriteNoteArgs,
  db: JournalDatabase | null,
  currentDayId: string,
): Promise<ToolResult> {
  if (!db) {
    return {
      tool_call_id: toolCallId,
      content: JSON.stringify({ error: 'Database not available' }),
    };
  }

  const dayId = args.dayId ?? currentDayId;
  let status: 'created' | 'updated';
  let note;

  if (args.noteId) {
    const updated = await updateNote(db, args.noteId, args.content, args.title);
    if (!updated) {
      return {
        tool_call_id: toolCallId,
        content: JSON.stringify({ error: `Note not found: ${args.noteId}` }),
      };
    }
    note = updated;
    status = 'updated';
  } else {
    note = await createNote(db, dayId, args.category, args.content, args.title);
    status = 'created';
  }

  const currentNotes = await getNotesForDay(db, dayId);

  return {
    tool_call_id: toolCallId,
    content: JSON.stringify({
      status,
      note: { id: note.id, category: note.category, title: note.title ?? null, content: note.content },
      currentNotes: currentNotes.map((n) => ({ id: n.id, category: n.category, title: n.title ?? null, content: n.content })),
    }),
  };
}

/**
 * Execute the delete_note tool
 */
async function executeDeleteNote(
  toolCallId: string,
  args: { noteId: string },
  db: JournalDatabase | null,
): Promise<ToolResult> {
  if (!db) {
    return {
      tool_call_id: toolCallId,
      content: JSON.stringify({ error: 'Database not available' }),
    };
  }

  const deleted = await deleteNote(db, args.noteId);
  return {
    tool_call_id: toolCallId,
    content: JSON.stringify(
      deleted
        ? { status: 'deleted', noteId: args.noteId }
        : { error: `Note not found: ${args.noteId}` }
    ),
  };
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
  const searchQuery: Parameters<typeof memoryService.search>[0] = {
    query,
    limit: limit + excludeCount,
    minScore,
  };
  if (dateRange) {
    searchQuery.dateRange = {
      ...(dateRange.startDate !== undefined && { startDate: dateRange.startDate }),
      ...(dateRange.endDate !== undefined && { endDate: dateRange.endDate }),
    };
  }
  const results = await memoryService.search(searchQuery);

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

/**
 * TanStack AI tool definition for memory search (used with useChat streaming)
 */
const memorySearchToolDef = toolDefinition({
  name: 'search_journal_memory' as const,
  description:
    'Search journal entries and notes using semantic similarity. Use this when you need context from their journal history. Use this when the user asks for anything that you have no information about.',
  inputSchema: z.object({
    query: z.string().describe('The search query to find relevant past entries'),
    limit: z.number().optional().describe('Maximum number of results to return (default: 5)'),
    minScore: z.number().optional().describe('Minimum similarity score from 0 to 1 (default: 0.3)'),
    dateRange: z.object({
      startDate: z.string().optional().describe('Earliest date to include (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('Latest date to include (YYYY-MM-DD)'),
    }).optional().describe('Optional date range filter using YYYY-MM-DD format'),
  }),
});

/**
 * Create a TanStack AI client tool for memory search.
 * Takes a ref to conversationMessageIds so the tool always reads fresh IDs
 * without needing to be recreated (which would destabilize the ChatClient).
 */
export function createMemorySearchClientTool(messageIdsRef: { current: string[] }) {
  return memorySearchToolDef.client(async (args) => {
    let searchArgs: MemorySearchArgs = { ...args };

    if (searchArgs.dateRange?.startDate === undefined && searchArgs.dateRange?.endDate === undefined) {
      const today = getTodayId();
      const weekAgo = format(subDays(parseISO(today), 7), 'yyyy-MM-dd');
      searchArgs.dateRange = {
        startDate: weekAgo,
        endDate: today,
      };
    }

    const result = await executeMemorySearch('client-tool', searchArgs, messageIdsRef.current);
    return JSON.parse(result.content);
  });
}

/**
 * OpenRouter-format tool definitions for the streaming connection.
 * These are sent to the API so the model knows what tools are available.
 */
export const OPENROUTER_TOOL_DEFINITIONS = JOURNAL_TOOLS;
