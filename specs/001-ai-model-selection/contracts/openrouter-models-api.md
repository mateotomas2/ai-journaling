# OpenRouter Models API Contract

**Endpoint**: `GET https://openrouter.ai/api/v1/models`
**Purpose**: Fetch list of available AI models from OpenRouter
**Consumer**: Frontend (React settings page)

## Request

### HTTP Method
`GET`

### Headers

| Header | Required | Value | Description |
|--------|----------|-------|-------------|
| `Authorization` | Yes | `Bearer {apiKey}` | User's OpenRouter API key |
| `Content-Type` | No | `application/json` | Standard content type |

### Query Parameters

None

### Request Body

None (GET request)

### Example Request

```http
GET /api/v1/models HTTP/1.1
Host: openrouter.ai
Authorization: Bearer sk-or-v1-abc123...
Content-Type: application/json
```

## Response

### Success Response (200 OK)

**Content-Type**: `application/json`

**Schema**:
```typescript
{
  data: Array<{
    id: string;                    // Model identifier (e.g., "openai/gpt-4o")
    name: string;                  // Human-readable name (e.g., "OpenAI: GPT-4o")
    canonical_slug?: string;       // Canonical identifier
    hugging_face_id?: string;      // HuggingFace model ID if applicable
    description?: string;          // Model description
    created?: number;              // Creation timestamp
    context_length: number;        // Max context window size
    architecture: {
      modality: string;            // e.g., "text->text", "text+image->text"
      input_modalities: string[];  // e.g., ["text", "image"]
      output_modalities: string[]; // e.g., ["text"]
      tokenizer: string;           // Tokenizer type
      instruct_type: string | null;
    };
    pricing: {
      prompt: string;              // Cost per prompt token (decimal string)
      completion: string;          // Cost per completion token (decimal string)
      web_search?: string;         // Cost for web search if supported
      image?: string;              // Cost for image processing if supported
      request?: string;            // Per-request cost if applicable
    };
    top_provider: {
      context_length: number;
      max_completion_tokens: number | null;
      is_moderated: boolean;
    };
    supported_parameters?: string[]; // Supported API parameters
    default_parameters?: object;     // Default parameter values
    expiration_date?: number | null; // Deprecation timestamp if applicable
  }>
}
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "openai/gpt-4o",
      "name": "OpenAI: GPT-4o",
      "canonical_slug": "openai/gpt-4o",
      "description": "GPT-4o is OpenAI's flagship model...",
      "created": 1715500000,
      "context_length": 128000,
      "architecture": {
        "modality": "text+image->text",
        "input_modalities": ["text", "image"],
        "output_modalities": ["text"],
        "tokenizer": "GPT",
        "instruct_type": null
      },
      "pricing": {
        "prompt": "0.0000025",
        "completion": "0.000010"
      },
      "top_provider": {
        "context_length": 128000,
        "max_completion_tokens": 16384,
        "is_moderated": true
      },
      "supported_parameters": ["temperature", "top_p", "max_tokens"],
      "default_parameters": {
        "temperature": 1.0
      },
      "expiration_date": null
    },
    {
      "id": "anthropic/claude-sonnet-4.5",
      "name": "Anthropic: Claude Sonnet 4.5",
      "context_length": 200000,
      "architecture": {
        "modality": "text+image->text",
        "input_modalities": ["text", "image"],
        "output_modalities": ["text"],
        "tokenizer": "Claude",
        "instruct_type": null
      },
      "pricing": {
        "prompt": "0.000003",
        "completion": "0.000015"
      },
      "top_provider": {
        "context_length": 200000,
        "max_completion_tokens": 8192,
        "is_moderated": false
      },
      "expiration_date": null
    }
  ]
}
```

### Error Responses

#### 401 Unauthorized
Invalid or missing API key

```json
{
  "error": {
    "message": "Invalid API key",
    "code": "invalid_api_key"
  }
}
```

#### 429 Too Many Requests
Rate limit exceeded

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "rate_limit_exceeded"
  }
}
```

#### 500 Internal Server Error
OpenRouter service error

```json
{
  "error": {
    "message": "Internal server error",
    "code": "internal_error"
  }
}
```

## Frontend Integration

### Data Transformation

Transform API response to internal `AIModel` type:

```typescript
function transformToAIModel(apiModel: any): AIModel {
  return {
    id: apiModel.id,
    name: apiModel.name,
    provider: extractProvider(apiModel.name || apiModel.id),
    pricing: {
      prompt: apiModel.pricing.prompt,
      completion: apiModel.pricing.completion
    },
    contextLength: apiModel.context_length
  };
}

function extractProvider(nameOrId: string): string {
  // Extract from name (e.g., "OpenAI: GPT-4o" → "OpenAI")
  const match = nameOrId.match(/^([^:]+):/);
  if (match) return match[1].trim();

  // Extract from ID (e.g., "openai/gpt-4o" → "OpenAI")
  const [provider] = nameOrId.split('/');
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
```

### Error Handling

```typescript
async function fetchModels(apiKey: string): Promise<AIModel[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`OpenRouter API returned ${response.status}, using fallback models`);
      return FALLBACK_MODELS;
    }

    const data = await response.json();
    return data.data.map(transformToAIModel);
  } catch (error) {
    console.error('Failed to fetch models from OpenRouter:', error);
    return FALLBACK_MODELS;
  }
}
```

### Caching (Future Enhancement)

Not implemented in MVP. Can be added later:

```typescript
// Example caching strategy (not implemented yet)
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let modelCache: { models: AIModel[], timestamp: number } | null = null;

function getCachedModels(): AIModel[] | null {
  if (!modelCache) return null;
  if (Date.now() - modelCache.timestamp > CACHE_DURATION) return null;
  return modelCache.models;
}
```

## Notes

- API response is ~500KB for 339 models (acceptable for modern browsers)
- No pagination - all models returned in single response
- Model list is relatively static (updates infrequently)
- API key is user's personal key, stored encrypted in IndexedDB
- No rate limiting concerns for normal usage (fetched only on settings page load)
