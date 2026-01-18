# Data Model: AI Model Selection

**Feature**: 001-ai-model-selection
**Date**: 2026-01-18
**Status**: Complete

## Overview

This document defines the data entities, their fields, relationships, and validation rules for the AI model selection feature. The feature extends the existing Settings entity and introduces a new AIModel type.

## Entities

### 1. Settings (Extended)

**Description**: User settings document stored in RxDB. Extended to include AI model preference for summarization.

**Storage**: RxDB (IndexedDB, encrypted at rest)

**Schema Definition** (Zod):
```typescript
import { z } from 'zod';

export const settingsSchema = z.object({
  id: z.literal('settings'),
  openRouterApiKey: z.string().optional(),
  systemPrompt: z.string().optional(),
  summarizerModel: z.string().optional(), // NEW FIELD
  updatedAt: z.number()
});

export type Settings = z.infer<typeof settingsSchema>;
```

**Fields**:

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `id` | literal string | Yes | `'settings'` | Singleton document ID | Must be exactly 'settings' |
| `openRouterApiKey` | string | No | undefined | User's OpenRouter API key | Min 10 chars when present |
| `systemPrompt` | string | No | undefined | Custom AI system prompt | Any string when present |
| `summarizerModel` | string | No | undefined | Selected AI model ID | Valid model ID format (provider/model) |
| `updatedAt` | number | Yes | Date.now() | Last update timestamp | Unix timestamp in milliseconds |

**New Field Details**:

- **summarizerModel**:
  - Purpose: Stores the user's selected AI model for summary generation
  - Format: `{provider}/{model-name}` (e.g., "openai/gpt-4o")
  - Examples:
    - `"openai/gpt-4o"`
    - `"anthropic/claude-sonnet-4.5"`
    - `"google/gemini-2.5-flash"`
  - When undefined: System uses default model "openai/gpt-4o"
  - Validation: Matches pattern `/^[a-z0-9-]+\/[a-z0-9.-]+$/i`

**Relationships**:
- None (singleton document)

**Indexing**:
- Primary: `id` (singleton, always 'settings')

**State Transitions**:
- Settings can be updated at any time
- Model selection change is immediate (no approval workflow)
- Validation occurs before persistence

**Validation Rules**:
1. Document ID must be 'settings'
2. If `summarizerModel` is provided, must match valid model ID format
3. `updatedAt` must be updated on any field change
4. Optional fields can be undefined but not null

### 2. AIModel (Frontend Type)

**Description**: Represents an AI model fetched from OpenRouter API. Used for display in model selector dropdown. Not persisted in database - only stored in memory during session.

**Storage**: None (transient, in-memory only)

**Type Definition** (TypeScript):
```typescript
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  pricing: {
    prompt: string;      // Cost per token (as decimal string)
    completion: string;  // Cost per token (as decimal string)
  };
  contextLength?: number;
}
```

**Fields**:

| Field | Type | Required | Description | Source |
|-------|------|----------|-------------|--------|
| `id` | string | Yes | Unique model identifier | OpenRouter API `id` field |
| `name` | string | Yes | Human-readable display name | OpenRouter API `name` field |
| `provider` | string | Yes | Provider name (OpenAI, Anthropic, etc.) | Extracted from `name` or `id` |
| `pricing.prompt` | string | Yes | Cost per prompt token | OpenRouter API `pricing.prompt` |
| `pricing.completion` | string | Yes | Cost per completion token | OpenRouter API `pricing.completion` |
| `contextLength` | number | No | Maximum context window size | OpenRouter API `context_length` |

**Derived Fields**:
- `provider`: Extracted from `name` (e.g., "OpenAI: GPT-4o" → "OpenAI") or from `id` prefix (e.g., "openai/gpt-4o" → "OpenAI")

**Example**:
```typescript
const model: AIModel = {
  id: "openai/gpt-4o",
  name: "OpenAI: GPT-4o",
  provider: "OpenAI",
  pricing: {
    prompt: "0.0000025",
    completion: "0.000010"
  },
  contextLength: 128000
};
```

**Validation Rules**:
1. `id` must not be empty
2. `name` must not be empty
3. `pricing.prompt` must be a valid decimal string
4. `pricing.completion` must be a valid decimal string
5. `contextLength` must be positive if provided

**Relationships**:
- Many AIModels can exist in memory (list from API)
- One AIModel's `id` corresponds to Settings.summarizerModel
- Not persisted - re-fetched on each settings page load

### 3. Fallback Models (Constant)

**Description**: Hardcoded list of popular models used when OpenRouter API is unavailable.

**Storage**: Source code constant (not in database)

**Definition**:
```typescript
export const FALLBACK_MODELS: AIModel[] = [
  {
    id: 'openai/gpt-4o',
    name: 'OpenAI: GPT-4o',
    provider: 'OpenAI',
    pricing: { prompt: '0.0000025', completion: '0.000010' },
    contextLength: 128000
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'OpenAI: GPT-4o-mini',
    provider: 'OpenAI',
    pricing: { prompt: '0.00000015', completion: '0.0000006' },
    contextLength: 128000
  },
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'OpenAI: GPT-3.5 Turbo',
    provider: 'OpenAI',
    pricing: { prompt: '0.0000005', completion: '0.0000015' },
    contextLength: 16385
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Anthropic: Claude Sonnet 4.5',
    provider: 'Anthropic',
    pricing: { prompt: '0.000003', completion: '0.000015' },
    contextLength: 200000
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Google: Gemini 2.5 Flash',
    provider: 'Google',
    pricing: { prompt: '0.0000003', completion: '0.0000012' },
    contextLength: 1000000
  }
];
```

**Purpose**: Ensures feature works even when OpenRouter API is down or unreachable.

## Data Flow

```
┌─────────────────┐
│  Settings Page  │
│   (React UI)    │
└────────┬────────┘
         │
         ├──(1)── Fetch Models ────────────┐
         │                                  ▼
         │                          ┌──────────────┐
         │                          │  OpenRouter  │
         │                          │     API      │
         │                          └──────┬───────┘
         │                                 │
         │◄───(2)── AIModel[] ─────────────┘
         │         (or Fallback)
         │
         ├──(3)── Display in Dropdown
         │
         ├──(4)── User Selects Model
         │
         ├──(5)── Save modelId to Settings
         │
         ▼
┌─────────────────┐
│  RxDB Settings  │
│   (IndexedDB)   │
└─────────────────┘
         │
         ├──(6)── Read modelId when generating summary
         │
         ▼
┌─────────────────┐
│  Summary API    │
│   (/api/summary)│
└─────────────────┘
```

## State Management

### Settings State

**Initial State**:
- `summarizerModel`: undefined (uses default "openai/gpt-4o")

**State Transitions**:
1. **Unset → Set**: User selects model for first time
2. **Set → Different Model**: User changes model selection
3. **Set → Unset**: Not supported (always has a value, falls back to default)

**Persistence**:
- Immediate persistence on selection change
- No validation against current available models (model ID is free-form string)
- RxDB handles encryption and storage

### Model List State

**Lifecycle**:
1. **Loading**: Settings page mounts → fetch models from API
2. **Success**: API returns → populate dropdown with AIModel[]
3. **Failure**: API errors → use FALLBACK_MODELS
4. **Filtering**: User types in search → filter model list client-side

**Caching**: Not implemented in MVP (re-fetch on each settings page load)

## Migration Strategy

### Version 1 (Current Implementation)

No migration needed - `summarizerModel` is optional field.

**Backward Compatibility**:
- Existing settings documents without `summarizerModel` work as-is
- System falls back to "openai/gpt-4o" when field is undefined
- No data migration required

### Future Versions (if needed)

If we later need to set default for all existing documents:

```typescript
// RxDB migration (example)
const migrations = {
  1: (oldDoc: any) => {
    if (!oldDoc.summarizerModel) {
      oldDoc.summarizerModel = 'openai/gpt-4o';
    }
    return oldDoc;
  }
};
```

## Validation Examples

### Valid Settings Updates

```typescript
// Adding model for first time
await settings.patch({ summarizerModel: 'openai/gpt-4o' });

// Changing to different model
await settings.patch({ summarizerModel: 'anthropic/claude-sonnet-4.5' });

// Updating multiple fields
await settings.patch({
  summarizerModel: 'google/gemini-2.5-flash',
  systemPrompt: 'Custom prompt',
  updatedAt: Date.now()
});
```

### Invalid Settings Updates

```typescript
// Invalid: null instead of undefined or string
await settings.patch({ summarizerModel: null });  // ❌ Fails Zod validation

// Invalid: empty string
await settings.patch({ summarizerModel: '' });    // ❌ Should use undefined instead

// Invalid: malformed model ID
await settings.patch({ summarizerModel: 'invalid model id' }); // ⚠️ Allowed but may fail at runtime
```

## Query Patterns

### Get Current Model

```typescript
const settings = await db.settings.findOne('settings').exec();
const modelId = settings?.summarizerModel || 'openai/gpt-4o';
```

### Update Model

```typescript
const settings = await db.settings.findOne('settings').exec();
if (!settings) throw new Error('Settings not initialized');
await settings.patch({
  summarizerModel: newModelId,
  updatedAt: Date.now()
});
```

### Check if Model is Set

```typescript
const settings = await db.settings.findOne('settings').exec();
const hasCustomModel = !!settings?.summarizerModel;
```

## Performance Considerations

- **Settings Read**: O(1) - singleton document lookup
- **Settings Write**: O(1) - single document patch
- **Model List Fetch**: O(n) where n=339 - acceptable for UI rendering
- **Model Search/Filter**: O(n) - client-side array filter - acceptable for 339 items

## Security Considerations

- **Encryption**: Settings document is encrypted at rest in IndexedDB (existing RxDB feature)
- **Model ID Validation**: No strict validation - allows flexibility but may fail at OpenRouter API if invalid
- **API Key**: Existing field, not modified by this feature
- **Data Leakage**: Model preference is stored locally only, not transmitted except when passed to /api/summary endpoint

## Testing Strategy

### Unit Tests
- Zod schema validation for Settings
- AIModel type guards
- Provider extraction from model name/id
- Fallback model list completeness

### Integration Tests
- Settings persistence (create/read/update)
- Model list fetch from API
- Fallback behavior on API failure
- Summary generation with selected model

### Edge Cases
- Undefined summarizerModel (fallback to default)
- Invalid model ID format (graceful handling)
- API timeout (fallback to hardcoded list)
- Selected model no longer in API response (use anyway, may fail at runtime)
