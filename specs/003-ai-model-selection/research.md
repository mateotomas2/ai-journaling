# Research: AI Model Selection for Summarizer

**Feature**: 001-ai-model-selection
**Date**: 2026-01-18
**Status**: Complete

## Overview

This document contains research findings for implementing AI model selection in the settings UI, including OpenRouter API integration, RxDB schema extension patterns, and React dropdown component best practices.

## Research Areas

### 1. OpenRouter API Integration

**Question**: How to fetch and handle the model list from OpenRouter API (`https://openrouter.ai/api/v1/models`)?

**Decision**: Use native `fetch` API with error handling and fallback strategy.

**Rationale**:
- OpenRouter API returns JSON with 339+ models
- Response format: `{ data: [{ id, name, pricing: { prompt, completion }, ... }] }`
- Requires Authorization header with Bearer token (user's API key)
- No additional dependencies needed - native fetch is sufficient
- Response size is manageable (~500KB for full model list)

**Implementation Pattern**:
```typescript
interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
}

async function fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
}
```

**Alternatives Considered**:
- Axios/third-party HTTP client: Rejected - unnecessary dependency for simple GET request
- Server-side caching: Rejected - adds complexity, not needed for infrequent fetches
- WebSocket/streaming: Rejected - model list is static enough for simple HTTP GET

### 2. Fallback Model List Strategy

**Question**: What models should be included in the fallback list when OpenRouter API is unavailable?

**Decision**: Curated list of 5 popular models from major providers

**Models Selected**:
1. `openai/gpt-4o` - Default, balanced performance
2. `openai/gpt-4o-mini` - Budget option
3. `openai/gpt-3.5-turbo` - Legacy/cheap option
4. `anthropic/claude-sonnet-4.5` - Alternative provider (Anthropic)
5. `google/gemini-2.5-flash` - Alternative provider (Google)

**Rationale**:
- Covers major providers (OpenAI, Anthropic, Google)
- Includes range of pricing tiers (budget to premium)
- All models are well-established and unlikely to be deprecated soon
- Small enough list to be maintainable
- Matches the requirements from FR-008

**Alternatives Considered**:
- Larger fallback list (20+ models): Rejected - harder to maintain, defeats purpose of dynamic fetching
- No fallback: Rejected - violates FR-008 requirement for graceful degradation
- Cache API response: Considered but rejected for MVP - adds complexity, can be added later if needed

### 3. RxDB Schema Extension Pattern

**Question**: How to add the `summarizerModel` field to the existing Settings schema without breaking existing data?

**Decision**: Add optional field with Zod schema, use RxDB migration if needed

**Pattern**:
```typescript
// Existing schema (from settings.schema.ts)
const settingsSchema = z.object({
  id: z.literal('settings'),
  openRouterApiKey: z.string().optional(),
  systemPrompt: z.string().optional(),
  // Add new field as optional
  summarizerModel: z.string().optional(),
  updatedAt: z.number()
});
```

**Rationale**:
- Optional field maintains backward compatibility
- No migration needed if field is optional
- RxDB handles undefined values gracefully
- Existing settings documents will work without the new field
- Zod validation ensures type safety

**Migration Strategy** (if needed later):
```typescript
// If we need to set default value for existing documents
const migration = {
  1: (oldDoc) => {
    oldDoc.summarizerModel = 'openai/gpt-4o';
    return oldDoc;
  }
};
```

**Alternatives Considered**:
- Required field with migration: Rejected - unnecessary complexity for MVP
- Separate model collection: Rejected - over-engineering for single setting
- Store full model object: Rejected - only need ID string, reduces storage

### 4. React Dropdown Component Patterns

**Question**: What's the best pattern for a searchable dropdown with 339+ items?

**Decision**: Native `<select>` with `<datalist>` for search, or custom component with virtualization if performance issues

**Recommended Approach (Start Simple)**:
```typescript
// Phase 1: Simple select with filter input
<div>
  <input
    type="text"
    placeholder="Search models..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
  <select
    value={selectedModel}
    onChange={(e) => setSelectedModel(e.target.value)}
  >
    {filteredModels.map(model => (
      <option key={model.id} value={model.id}>
        {model.name} - ${model.pricing.prompt}/token
      </option>
    ))}
  </select>
</div>
```

**Performance Consideration**:
- Filter array client-side (Array.filter on name/id)
- 339 items is manageable for modern browsers
- Consider virtualization (react-window) only if performance issues arise

**Accessibility**:
- Use `<label>` elements with `htmlFor`
- ARIA labels for screen readers
- Keyboard navigation (native with `<select>`)

**Alternatives Considered**:
- Third-party dropdown library (e.g., react-select): Rejected - new dependency violates YAGNI
- Virtualized list from start: Rejected - premature optimization
- Autocomplete/combobox pattern: Considered - may implement if select proves insufficient

### 5. Settings Persistence Pattern

**Question**: How to persist and retrieve the selected model in RxDB?

**Decision**: Use existing settings service pattern with new getter/setter methods

**Pattern**:
```typescript
// In settings.service.ts
export async function getSummarizerModel(db: JournalDatabase): Promise<string> {
  const settings = await db.settings.findOne('settings').exec();
  return settings?.summarizerModel || 'openai/gpt-4o'; // default
}

export async function updateSummarizerModel(db: JournalDatabase, modelId: string): Promise<void> {
  const settings = await db.settings.findOne('settings').exec();
  if (!settings) {
    throw new Error('Settings not initialized');
  }
  await settings.patch({ summarizerModel: modelId });
}
```

**Rationale**:
- Follows existing pattern used for `openRouterApiKey` and `systemPrompt`
- Centralized in settings service
- Type-safe with RxDB's TypeScript integration
- Handles missing settings document gracefully

**Alternatives Considered**:
- Direct RxDB access from components: Rejected - violates separation of concerns
- Separate model settings document: Rejected - over-engineering

### 6. Summary Generation Integration

**Question**: How to pass the selected model from frontend to backend summary generation?

**Decision**: Fetch model from settings in backend before calling OpenRouter

**Pattern**:
```typescript
// In server/routes/ai.ts - /api/summary endpoint
router.post('/summary', async (req, res) => {
  const { messages, date, apiKey } = req.body;

  // NEW: Get selected model from request body
  const { model = 'openai/gpt-4o' } = req.body;

  // Use selected model instead of hardcoded MODEL constant
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({
      model: model, // Use selected model here
      messages: [...]
    })
  });
  // ...
});
```

**Frontend Update**:
```typescript
// In summary.service.ts
export async function generateSummary(
  messages: Message[],
  date: string,
  apiKey: string,
  summarizerModel?: string // NEW parameter
): Promise<SummaryResponse> {
  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date,
      messages: [...],
      apiKey,
      model: summarizerModel || 'openai/gpt-4o' // Include model
    }),
  });
  // ...
}
```

**Rationale**:
- Backend is stateless (doesn't need to access RxDB)
- Frontend has easy access to settings via RxDB
- Maintains existing API structure with minimal changes
- Default fallback ensures backward compatibility

**Alternatives Considered**:
- Backend reads from database: Rejected - backend shouldn't depend on frontend database
- Global config file: Rejected - defeats purpose of per-user settings
- Separate endpoint for model selection: Rejected - unnecessary complexity

## Summary of Decisions

| Area | Decision | Key Rationale |
|------|----------|---------------|
| API Integration | Native fetch with error handling | No new dependencies, simple GET request |
| Fallback Strategy | 5 curated popular models | Balance between coverage and maintainability |
| RxDB Schema | Optional field, no migration | Backward compatible, minimal complexity |
| UI Component | Native select + filter input (start simple) | YAGNI - avoid premature optimization |
| Persistence | Extend existing settings service | Consistent with established patterns |
| Backend Integration | Pass model from frontend in request | Stateless backend, simple modification |

## Open Questions / Future Enhancements

- **Model Caching**: Should we cache the API response? (Decision: Not for MVP, can add later if needed)
- **Model Grouping**: Group models by provider in UI? (Decision: Not for MVP, linear list is simpler)
- **Model Recommendations**: Suggest models based on usage? (Decision: YAGNI, future enhancement)
- **Model Deprecation Alerts**: Notify when saved model is deprecated? (Decision: Handle gracefully but don't alert for MVP)

## References

- OpenRouter API Docs: https://openrouter.ai/docs
- RxDB Schema Migration: https://rxdb.info/migration-schema.html
- React Accessibility: https://react.dev/learn/accessibility
- TypeScript Strict Mode: https://www.typescriptlang.org/tsconfig#strict
