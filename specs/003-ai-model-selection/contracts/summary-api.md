# Summary API Contract (Modified)

**Endpoint**: `POST /api/summary`
**Purpose**: Generate daily journal summary using selected AI model
**Consumer**: Frontend (Journal/Summary pages)
**Changes**: Add `model` parameter to request body

## Request

### HTTP Method
`POST`

### Headers

| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | Yes | `application/json` |

### Request Body

**Schema**:
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  date: string;           // Format: YYYY-MM-DD
  apiKey: string;         // User's OpenRouter API key
  model?: string;         // NEW: Selected AI model ID (optional)
}
```

**Fields**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `messages` | Message[] | Yes | Journal conversation for the day | Non-empty array |
| `date` | string | Yes | Date for the summary | YYYY-MM-DD format |
| `apiKey` | string | Yes | OpenRouter API key | Non-empty string |
| `model` | string | No | AI model to use for summary | Valid model ID format |

**NEW Field Details**:

- **model** (optional):
  - If provided: Use this model for summary generation
  - If omitted: Use default model "openai/gpt-4o"
  - Format: `{provider}/{model-name}` (e.g., "anthropic/claude-sonnet-4.5")
  - Passed directly to OpenRouter API

### Example Request (Before - Without Model Selection)

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Today I felt really productive...",
      "timestamp": 1705564800000
    },
    {
      "role": "assistant",
      "content": "That's great to hear!...",
      "timestamp": 1705564805000
    }
  ],
  "date": "2026-01-18",
  "apiKey": "sk-or-v1-abc123..."
}
```

### Example Request (After - With Model Selection)

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Today I felt really productive...",
      "timestamp": 1705564800000
    },
    {
      "role": "assistant",
      "content": "That's great to hear!...",
      "timestamp": 1705564805000
    }
  ],
  "date": "2026-01-18",
  "apiKey": "sk-or-v1-abc123...",
  "model": "anthropic/claude-sonnet-4.5"
}
```

## Response

### Success Response (200 OK)

**Content-Type**: `application/json`

**Schema** (unchanged):
```typescript
{
  summary: {
    journal: string;
    insights: string;
    health: string;
    dreams: string;
  };
  rawContent: string;
}
```

**Example Response**:
```json
{
  "summary": {
    "journal": "User had a productive day working on the AI journaling project...",
    "insights": "Noticed a pattern of increased energy when working on creative tasks...",
    "health": "Reported good sleep (8 hours) and feeling energized throughout the day.",
    "dreams": "No dreams recorded for this day."
  },
  "rawContent": "## Journal\nUser had a productive day...\n\n## Insights\nNoticed a pattern..."
}
```

### Error Responses

#### 400 Bad Request
Invalid request parameters

```json
{
  "error": "Messages required"
}
```

```json
{
  "error": "Invalid date format"
}
```

```json
{
  "error": "API key required"
}
```

#### 401 Unauthorized
Invalid OpenRouter API key

```json
{
  "error": "Invalid API key"
}
```

#### 429 Too Many Requests
OpenRouter rate limit exceeded

```json
{
  "error": "Rate limit exceeded"
}
```

#### 500 Internal Server Error
Summary generation failed

```json
{
  "error": "Summary generation failed"
}
```

## Backend Implementation Changes

### Before (Hardcoded Model)

```typescript
// server/routes/ai.ts
const MODEL = 'openai/gpt-4o'; // Hardcoded constant

router.post('/summary', async (req, res) => {
  const { messages, date, apiKey } = req.body;

  // ... validation ...

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({
      model: MODEL, // Always uses hardcoded model
      messages: [ /* ... */ ]
    })
  });

  // ... response handling ...
});
```

### After (Dynamic Model from Request)

```typescript
// server/routes/ai.ts
const DEFAULT_MODEL = 'openai/gpt-4o'; // Fallback default

router.post('/summary', async (req, res) => {
  const { messages, date, apiKey, model } = req.body; // NEW: extract model

  // ... validation ...

  const selectedModel = model || DEFAULT_MODEL; // Use provided model or default

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({
      model: selectedModel, // Use dynamic model
      messages: [ /* ... */ ]
    })
  });

  // ... response handling ...
});
```

## Frontend Service Changes

### Before (No Model Parameter)

```typescript
// src/services/ai/summary.service.ts
export async function generateSummary(
  messages: Message[],
  date: string
): Promise<SummaryResponse> {
  const apiKey = await getApiKey(db);
  if (!apiKey) throw new Error('API key not configured');

  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date,
      messages,
      apiKey
    }),
  });

  // ... response handling ...
}
```

### After (With Model Parameter)

```typescript
// src/services/ai/summary.service.ts
export async function generateSummary(
  messages: Message[],
  date: string,
  summarizerModel?: string // NEW: optional model parameter
): Promise<SummaryResponse> {
  const apiKey = await getApiKey(db);
  if (!apiKey) throw new Error('API key not configured');

  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date,
      messages,
      apiKey,
      ...(summarizerModel && { model: summarizerModel }) // Include if provided
    }),
  });

  // ... response handling ...
}
```

### Usage Example

```typescript
// In component that triggers summary generation
const summarizerModel = await getSummarizerModel(db); // Get from settings
const summary = await generateSummary(messages, date, summarizerModel);
```

## Backward Compatibility

✅ **Fully backward compatible**

- Existing callers without `model` parameter will use default model
- Backend falls back to `DEFAULT_MODEL` if `model` is undefined
- No breaking changes to response format
- Existing tests continue to pass

## Migration Strategy

1. Deploy backend changes first (accepts optional `model` parameter)
2. Backend remains compatible with old frontend (no `model` sent)
3. Deploy frontend changes to start sending `model` parameter
4. Monitor logs to confirm model selection is working

## Testing Requirements

### Backend Tests

```typescript
describe('POST /api/summary', () => {
  it('should use provided model when specified', async () => {
    const response = await request(app)
      .post('/api/summary')
      .send({
        messages: [...],
        date: '2026-01-18',
        apiKey: 'sk-test-key',
        model: 'anthropic/claude-sonnet-4.5'
      });

    // Verify OpenRouter was called with correct model
    expect(openRouterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('anthropic/claude-sonnet-4.5')
      })
    );
  });

  it('should use default model when not specified', async () => {
    const response = await request(app)
      .post('/api/summary')
      .send({
        messages: [...],
        date: '2026-01-18',
        apiKey: 'sk-test-key'
        // No model field
      });

    // Verify OpenRouter was called with default model
    expect(openRouterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('openai/gpt-4o')
      })
    );
  });
});
```

### Frontend Integration Tests

```typescript
describe('generateSummary', () => {
  it('should include model in request when provided', async () => {
    await generateSummary(messages, '2026-01-18', 'google/gemini-2.5-flash');

    expect(fetchMock).toHaveBeenCalledWith('/api/summary', {
      method: 'POST',
      body: expect.stringContaining('google/gemini-2.5-flash')
    });
  });

  it('should omit model from request when not provided', async () => {
    await generateSummary(messages, '2026-01-18');

    expect(fetchMock).toHaveBeenCalledWith('/api/summary', {
      method: 'POST',
      body: expect.not.stringContaining('"model"')
    });
  });
});
```

## Notes

- Model validation happens at OpenRouter API level (backend doesn't validate model IDs)
- Invalid model IDs will return error from OpenRouter (propagated to user)
- No additional latency - model parameter is just passed through
- No caching of model preference in backend (stateless design)
