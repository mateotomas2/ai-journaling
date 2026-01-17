# API Contracts: Daily Journal Chat

**Date**: 2026-01-16 | **Branch**: `001-daily-journal-chat`

## Overview

Minimal server API for proxying AI requests to OpenRouter. All journal data is stored locally in RxDB; the server only handles OpenRouter API communication to keep API keys secure.

**Base URL**: `/api` (proxied via Vite in development)

---

## Endpoints

### POST /api/chat

Proxy chat messages to OpenRouter GPT-4o.

**Purpose**: Keep user's OpenRouter API key from being exposed in browser network requests.

#### Request

```http
POST /api/chat
Content-Type: application/json
```

```typescript
interface ChatRequest {
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  apiKey: string;  // User's OpenRouter API key (sent encrypted from client, decrypted before use)
}
```

**Example**:
```json
{
  "messages": [
    { "role": "system", "content": "You are a thoughtful journaling companion..." },
    { "role": "user", "content": "I had a really productive day today." },
    { "role": "assistant", "content": "That's great to hear! What made it feel productive?" },
    { "role": "user", "content": "I finished the project I've been working on for weeks." }
  ],
  "apiKey": "sk-or-v1-..."
}
```

#### Response

```typescript
interface ChatResponse {
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
```

**Example**:
```json
{
  "id": "gen-123abc",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "That's a wonderful accomplishment! How do you feel now that it's done?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 25,
    "total_tokens": 175
  }
}
```

#### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "error": "Messages required" }` | Empty or missing messages array |
| 400 | `{ "error": "API key required" }` | Missing apiKey field |
| 401 | `{ "error": "Invalid API key" }` | OpenRouter rejected the key |
| 429 | `{ "error": "Rate limit exceeded" }` | OpenRouter rate limit hit |
| 500 | `{ "error": "AI service error" }` | OpenRouter API failure |

---

### POST /api/summary

Generate a daily summary from messages.

**Purpose**: Process a day's messages into structured summary sections using GPT-4o.

#### Request

```http
POST /api/summary
Content-Type: application/json
```

```typescript
interface SummaryRequest {
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }[];
  date: string;  // YYYY-MM-DD format
  apiKey: string;
}
```

**Example**:
```json
{
  "date": "2026-01-15",
  "apiKey": "sk-or-v1-...",
  "messages": [
    {
      "role": "user",
      "content": "I slept about 7 hours last night.",
      "timestamp": 1737000000000
    },
    {
      "role": "assistant",
      "content": "That sounds like a decent night's rest. How are you feeling?",
      "timestamp": 1737000010000
    },
    {
      "role": "user",
      "content": "Tired but okay. Had a weird dream about flying.",
      "timestamp": 1737000020000
    }
  ]
}
```

#### Response

```typescript
interface SummaryResponse {
  summary: {
    journal: string;
    insights: string;
    health: string;
    dreams: string;
  };
  rawContent: string;
}
```

**Example**:
```json
{
  "summary": {
    "journal": "A day of mixed energy following moderate sleep.",
    "insights": "No specific insights recorded.",
    "health": "Slept 7 hours, reported feeling tired but okay.",
    "dreams": "Had a dream about flying."
  },
  "rawContent": "## General Journal\nA day of mixed energy following moderate sleep.\n\n## Health\nSlept 7 hours, reported feeling tired but okay.\n\n## Dreams\nHad a dream about flying.\n\n## Insights\nNo specific insights recorded."
}
```

#### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "error": "Messages required" }` | Empty or missing messages |
| 400 | `{ "error": "Invalid date format" }` | Date not YYYY-MM-DD |
| 400 | `{ "error": "API key required" }` | Missing apiKey |
| 500 | `{ "error": "Summary generation failed" }` | AI processing error |

---

### POST /api/query

Query historical summaries with natural language.

**Purpose**: Synthesize insights across multiple days of summaries using GPT-4o.

#### Request

```http
POST /api/query
Content-Type: application/json
```

```typescript
interface QueryRequest {
  query: string;
  summaries: {
    date: string;
    rawContent: string;
  }[];
  apiKey: string;
}
```

**Example**:
```json
{
  "query": "How was my sleep last week?",
  "apiKey": "sk-or-v1-...",
  "summaries": [
    { "date": "2026-01-15", "rawContent": "## Health\nSlept 7 hours..." },
    { "date": "2026-01-14", "rawContent": "## Health\nSlept 5 hours, felt exhausted..." },
    { "date": "2026-01-13", "rawContent": "## Health\nSlept 8 hours, well rested..." }
  ]
}
```

#### Response

```typescript
interface QueryResponse {
  response: string;
  citations: {
    date: string;
    excerpt: string;
  }[];
}
```

**Example**:
```json
{
  "response": "Based on your journal entries from the past week, your sleep has been variable. You averaged about 6.7 hours per night, with a low of 5 hours on January 14th when you felt exhausted, and a high of 8 hours on January 13th.",
  "citations": [
    { "date": "2026-01-14", "excerpt": "Slept 5 hours, felt exhausted" },
    { "date": "2026-01-13", "excerpt": "Slept 8 hours, well rested" },
    { "date": "2026-01-15", "excerpt": "Slept 7 hours" }
  ]
}
```

---

## Server Implementation Notes

### Express Server Setup

```typescript
// server/index.ts
import express from 'express';
import cors from 'cors';
import { aiRouter } from './routes/ai';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', aiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### OpenRouter Integration

```typescript
// server/routes/ai.ts
import { Router } from 'express';

const router = Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

router.post('/chat', async (req, res) => {
  const { messages, apiKey } = req.body;

  if (!messages?.length) {
    return res.status(400).json({ error: 'Messages required' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://reflekt.app',
        'X-Title': 'Reflekt Journal'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'AI service error' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'AI service error' });
  }
});

export { router as aiRouter };
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |

**Note**: No server-side API key. User provides their own OpenRouter key per request.

---

## Client Integration

### Chat Service

```typescript
// src/services/ai/chat.ts
export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string
): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, apiKey })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Chat request failed');
  }

  return response.json();
}
```

### Vite Proxy Configuration

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
```

---

## Security Considerations

1. **API Key Handling**: User's OpenRouter key is stored encrypted in IndexedDB, decrypted in-memory only when needed
2. **No Server Storage**: Server does not store or log API keys
3. **HTTPS Required**: Production deployment must use HTTPS to protect key in transit
4. **Rate Limiting**: Consider adding server-side rate limiting to prevent abuse
