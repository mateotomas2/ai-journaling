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
  content: string;
  timestamp: number;
  categories?: Category[];
}

// Summary entity - AI-generated daily digest
export interface Summary {
  id: string; // Same as dayId
  dayId: string;
  generatedAt: number;
  sections: SummarySections;
  rawContent: string;
}

export interface SummarySections {
  journal: string;
  insights: string;
  health: string;
  dreams: string;
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

export interface QueryRequest {
  query: string;
  summaries: {
    date: string;
    rawContent: string;
  }[];
  apiKey: string;
}

export interface QueryResponse {
  response: string;
  citations: {
    date: string;
    excerpt: string;
  }[];
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
