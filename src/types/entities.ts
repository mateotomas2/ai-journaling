export type Category = 'journal' | 'insight' | 'health' | 'dream';
export type MessageRole = 'user' | 'assistant';

export interface Day {
  id: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
  timezone: string;
  hasSummary: boolean;
}

export interface Message {
  id: string;
  dayId: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  categories?: Category[];
}

export interface SummarySections {
  journal: string;
  insights: string;
  health: string;
  dreams: string;
}

export interface Summary {
  id: string;
  dayId: string;
  generatedAt: number;
  sections: SummarySections;
  rawContent: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  contextLength?: number;
}

export interface Embedding {
  id: string;
  messageId: string;
  vector: number[]; // 384-dimension array, stored as JSON, converted to Float32Array for computation
  modelVersion: string; // Format: "model-name@version" e.g., "all-MiniLM-L6-v2@v0"
  createdAt: number;
}
