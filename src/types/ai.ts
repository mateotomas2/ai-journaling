export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
}

export interface SummaryRequest {
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }[];
  date: string;
}

export interface SummaryResponse {
  summary: {
    journal: string;
    insights: string;
    health: string;
    dreams: string;
  };
  rawContent: string;
}

