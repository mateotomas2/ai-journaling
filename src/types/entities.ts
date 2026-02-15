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
  content: string;          // plain text extraction (for search/embedding only)
  parts: string;            // JSON-serialized UIMessage.parts array (source of truth for rendering)
  timestamp: number;
  deletedAt: number;        // 0 = not deleted, positive timestamp = soft-deleted
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
  deletedAt: number;        // 0 = not deleted, positive timestamp = soft-deleted
  sections: SummarySections;
  rawContent: string;
}

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

export type EmbeddingEntityType = 'message' | 'note';

export interface Embedding {
  id: string;
  entityType: EmbeddingEntityType;
  entityId: string;
  messageId?: string; // Deprecated: kept for migration compatibility
  vector: number[]; // 384-dimension array, stored as JSON, converted to Float32Array for computation
  modelVersion: string; // Format: "model-name@version" e.g., "all-MiniLM-L6-v2@v0"
  createdAt: number;
}
