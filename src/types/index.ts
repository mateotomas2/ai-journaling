// Category types for journal entries
export type Category = 'journal' | 'insight' | 'health' | 'dream';

// Settings entity - singleton for user configuration
export interface Settings {
  id: 'settings';
  openRouterApiKey?: string;
  systemPrompt?: string;
  summarizerModel?: string;
  chatModel?: string;
  timezone: string;
  setupComplete: boolean;
  createdAt: number;
}

// Day entity - represents a calendar day
export interface Day {
  id: string; // Format: YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
  timezone: string;
  hasSummary: boolean;
}

// Message entity - a single chat exchange
export interface Message {
  id: string; // UUID
  dayId: string;
  role: 'user' | 'assistant';
  content: string;          // plain text extraction (for search/embedding only)
  parts: string;            // JSON-serialized UIMessage.parts array (source of truth for rendering)
  timestamp: number;
  deletedAt: number;        // 0 = not deleted, positive timestamp = soft-deleted
  categories?: Category[];
}

// Summary entity - AI-generated daily digest (DEPRECATED - use Note with category="summary")
export interface Summary {
  id: string; // Same as dayId
  dayId: string;
  generatedAt: number;
  deletedAt: number;        // 0 = not deleted, positive timestamp = soft-deleted
  sections: SummarySections;
  rawContent: string;
}

export interface SummarySections {
  journal: string;
  insights: string;
  health: string;
  dreams: string;
}

// Note entity - flexible notes with categories
export interface Note {
  id: string; // UUID
  dayId: string; // YYYY-MM-DD
  category: string; // "summary", "personal", "ideas", etc.
  title?: string; // Optional title
  content: string; // Markdown content
  createdAt: number;
  updatedAt: number;
  deletedAt: number; // 0 = not deleted, positive timestamp = soft-deleted
}

// API Request/Response types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  apiKey: string;
  model?: string;
}

export interface ChatResponse {
  id: string;
  choices: {
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SummaryRequest {
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }[];
  date: string;
  apiKey: string;
}

export interface SummaryResponse {
  summary: SummarySections;
  rawContent: string;
}

// Auth state
export interface AuthState {
  isAuthenticated: boolean;
  isFirstTime: boolean;
  isLoading: boolean;
}

// Error types
export interface ApiError {
  error: string;
}

// Tool types for LLM function calling
export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      properties?: Record<string, unknown>;
    }>;
    required: string[];
  };
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}

// Extended message types for tool calling
export interface ChatMessageWithTools {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ChatResponseWithTools {
  id: string;
  choices: {
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
