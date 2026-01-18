# Quickstart: AI Model Selection Implementation

**Feature**: 001-ai-model-selection
**Date**: 2026-01-18
**Estimated Complexity**: Medium (3-5 days with TDD)

## Overview

This quickstart guide provides the implementation sequence for adding AI model selection to the settings UI. Follow TDD methodology: write tests first, then implement to pass those tests.

## Prerequisites

- [x] Feature specification complete ([spec.md](./spec.md))
- [x] Implementation plan complete ([plan.md](./plan.md))
- [x] Data model defined ([data-model.md](./data-model.md))
- [x] API contracts defined ([contracts/](./contracts/))
- [x] Development environment set up (Node.js, npm, TypeScript)
- [x] Tests run successfully: `npm test`

## Implementation Sequence

Follow this order to minimize integration issues and maintain TDD discipline.

### Phase 1: Data Layer (Settings Schema Extension)

**Duration**: ~4 hours

**Test First**:
```typescript
// tests/unit/settings.schema.test.ts
describe('Settings Schema', () => {
  it('should accept summarizerModel field', () => {
    const valid = settingsSchema.parse({
      id: 'settings',
      summarizerModel: 'openai/gpt-4o',
      updatedAt: Date.now()
    });
    expect(valid.summarizerModel).toBe('openai/gpt-4o');
  });

  it('should allow undefined summarizerModel', () => {
    const valid = settingsSchema.parse({
      id: 'settings',
      updatedAt: Date.now()
    });
    expect(valid.summarizerModel).toBeUndefined();
  });
});
```

**Implementation**:
1. Update `src/db/schemas/settings.schema.ts`:
   - Add `summarizerModel: z.string().optional()` to schema
2. Run tests: `npm test settings.schema.test.ts`
3. Update TypeScript types if schema export is used elsewhere

**Files Modified**:
- `src/db/schemas/settings.schema.ts`

---

### Phase 2: Settings Service Extension

**Duration**: ~4 hours

**Test First**:
```typescript
// tests/unit/settings.service.test.ts
describe('Summarizer Model Settings', () => {
  it('should return default model when not set', async () => {
    const model = await getSummarizerModel(db);
    expect(model).toBe('openai/gpt-4o');
  });

  it('should persist and retrieve selected model', async () => {
    await updateSummarizerModel(db, 'anthropic/claude-sonnet-4.5');
    const model = await getSummarizerModel(db);
    expect(model).toBe('anthropic/claude-sonnet-4.5');
  });

  it('should throw error if settings not initialized', async () => {
    // Assuming empty database
    await expect(updateSummarizerModel(db, 'openai/gpt-4o'))
      .rejects.toThrow('Settings not initialized');
  });
});
```

**Implementation**:
1. Add to `src/services/settings/settings.service.ts`:
   ```typescript
   export async function getSummarizerModel(db: JournalDatabase): Promise<string> {
     const settings = await db.settings.findOne('settings').exec();
     return settings?.summarizerModel || 'openai/gpt-4o';
   }

   export async function updateSummarizerModel(
     db: JournalDatabase,
     modelId: string
   ): Promise<void> {
     const settings = await db.settings.findOne('settings').exec();
     if (!settings) {
       throw new Error('Settings not initialized');
     }
     await settings.patch({ summarizerModel: modelId, updatedAt: Date.now() });
   }
   ```
2. Run tests: `npm test settings.service.test.ts`

**Files Modified**:
- `src/services/settings/settings.service.ts`

---

### Phase 3: Model Fetching Service

**Duration**: ~6 hours

**Test First**:
```typescript
// tests/unit/models.service.test.ts
describe('Models Service', () => {
  it('should fetch models from OpenRouter API', async () => {
    const models = await fetchModels('sk-test-key');
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).toHaveProperty('pricing');
  });

  it('should return fallback models on API failure', async () => {
    // Mock fetch to fail
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const models = await fetchModels('sk-test-key');
    expect(models).toEqual(FALLBACK_MODELS);
  });

  it('should extract provider from model name', () => {
    expect(extractProvider('OpenAI: GPT-4o')).toBe('OpenAI');
    expect(extractProvider('Anthropic: Claude Sonnet 4.5')).toBe('Anthropic');
    expect(extractProvider('openai/gpt-4o')).toBe('Openai');
  });
});
```

**Implementation**:
1. Create `src/services/ai/models.service.ts`:
   - Implement `fetchModels(apiKey: string): Promise<AIModel[]>`
   - Implement `extractProvider(nameOrId: string): string`
   - Define `FALLBACK_MODELS` constant
2. Create `src/types/entities.ts` (or extend existing):
   - Add `AIModel` interface
3. Run tests: `npm test models.service.test.ts`

**Files Created**:
- `src/services/ai/models.service.ts`

**Files Modified**:
- `src/types/entities.ts`

---

### Phase 4: Model Selector Component

**Duration**: ~8 hours

**Test First**:
```typescript
// tests/component/ModelSelector.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelSelector } from '@/components/settings/ModelSelector';

describe('ModelSelector', () => {
  it('should render dropdown with models', async () => {
    render(<ModelSelector value="openai/gpt-4o" onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('should filter models by search term', async () => {
    render(<ModelSelector value="" onChange={jest.fn()} />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'claude' } });

    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options.every(opt =>
        opt.textContent?.toLowerCase().includes('claude')
      )).toBe(true);
    });
  });

  it('should call onChange when model selected', async () => {
    const handleChange = jest.fn();
    render(<ModelSelector value="" onChange={handleChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'anthropic/claude-sonnet-4.5' } });

    expect(handleChange).toHaveBeenCalledWith('anthropic/claude-sonnet-4.5');
  });

  it('should display fallback models on API error', async () => {
    // Mock fetchModels to fail
    jest.mock('@/services/ai/models.service', () => ({
      fetchModels: jest.fn().mockRejectedValue(new Error('API error'))
    }));

    render(<ModelSelector value="" onChange={jest.fn()} />);

    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(5); // FALLBACK_MODELS count
    });
  });
});
```

**Implementation**:
1. Create `src/components/settings/ModelSelector.tsx`:
   - Fetch models on mount using `fetchModels`
   - Implement search/filter functionality
   - Render dropdown with pricing info
   - Handle loading and error states
2. Add ARIA labels for accessibility
3. Run tests: `npm test ModelSelector.test.tsx`

**Files Created**:
- `src/components/settings/ModelSelector.tsx`

---

### Phase 5: Settings Page Integration

**Duration**: ~4 hours

**Test First**:
```typescript
// tests/integration/settings-page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '@/pages/Settings';

describe('Settings Page - Model Selection', () => {
  it('should display model selector', () => {
    render(<Settings />);
    expect(screen.getByLabelText(/ai model/i)).toBeInTheDocument();
  });

  it('should load and display current model selection', async () => {
    // Mock getSummarizerModel to return saved model
    await updateSummarizerModel(db, 'google/gemini-2.5-flash');

    render(<Settings />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('google/gemini-2.5-flash');
    });
  });

  it('should save model selection on change', async () => {
    render(<Settings />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'openai/gpt-4o-mini' } });

    await waitFor(() => {
      // Verify persistence
      expect(getSummarizerModel(db)).resolves.toBe('openai/gpt-4o-mini');
    });
  });
});
```

**Implementation**:
1. Update `src/pages/Settings.tsx`:
   - Import `ModelSelector` component
   - Load current model with `getSummarizerModel`
   - Handle model change with `updateSummarizerModel`
   - Display in settings UI
2. Run tests: `npm test settings-page.test.tsx`

**Files Modified**:
- `src/pages/Settings.tsx`

---

### Phase 6: Summary Generation Integration

**Duration**: ~6 hours

**Test First - Backend**:
```typescript
// tests/integration/api.test.ts (modify existing)
describe('POST /api/summary with model selection', () => {
  it('should use provided model', async () => {
    const response = await request(app)
      .post('/api/summary')
      .send({
        messages: testMessages,
        date: '2026-01-18',
        apiKey: testApiKey,
        model: 'anthropic/claude-sonnet-4.5'
      });

    expect(response.status).toBe(200);
    // Verify OpenRouter was called with correct model
  });

  it('should use default model when not provided', async () => {
    const response = await request(app)
      .post('/api/summary')
      .send({
        messages: testMessages,
        date: '2026-01-18',
        apiKey: testApiKey
      });

    expect(response.status).toBe(200);
    // Verify default model was used
  });
});
```

**Test First - Frontend**:
```typescript
// tests/unit/summary.service.test.ts (modify existing)
describe('generateSummary with model selection', () => {
  it('should include model in request when provided', async () => {
    await generateSummary(messages, '2026-01-18', 'google/gemini-2.5-flash');

    expect(fetch).toHaveBeenCalledWith('/api/summary', {
      method: 'POST',
      body: expect.stringContaining('google/gemini-2.5-flash')
    });
  });
});
```

**Implementation**:
1. Update `server/routes/ai.ts`:
   - Extract `model` from request body
   - Use `model || 'openai/gpt-4o'` in OpenRouter API call
2. Update `src/services/ai/summary.service.ts`:
   - Add `summarizerModel?` parameter to `generateSummary`
   - Include in fetch body if provided
3. Update call sites to pass model from settings
4. Run tests: `npm test`

**Files Modified**:
- `server/routes/ai.ts`
- `src/services/ai/summary.service.ts`

---

### Phase 7: Integration Testing

**Duration**: ~4 hours

**End-to-End Test**:
```typescript
// tests/integration/model-selection.test.ts
describe('Model Selection E2E', () => {
  it('should complete full workflow', async () => {
    // 1. Open settings, no model selected
    const initialModel = await getSummarizerModel(db);
    expect(initialModel).toBe('openai/gpt-4o'); // Default

    // 2. Select a different model
    await updateSummarizerModel(db, 'anthropic/claude-sonnet-4.5');

    // 3. Verify persistence
    const savedModel = await getSummarizerModel(db);
    expect(savedModel).toBe('anthropic/claude-sonnet-4.5');

    // 4. Generate summary with selected model
    const summary = await generateSummary(
      testMessages,
      '2026-01-18',
      savedModel
    );

    expect(summary).toHaveProperty('summary');
    // Verify model was used (check via mock or logs)
  });

  it('should handle API unavailability gracefully', async () => {
    // Mock OpenRouter models API to fail
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    // Should still be able to select from fallback models
    const models = await fetchModels('sk-test-key');
    expect(models).toEqual(FALLBACK_MODELS);
  });
});
```

**Implementation**:
1. Run full test suite: `npm test`
2. Fix any integration issues
3. Verify all functional requirements from spec.md are met

---

## Development Workflow

### For Each Phase

1. **Write Tests First** (Red phase):
   ```bash
   npm test -- --watch <test-file>
   ```

2. **Implement to Pass Tests** (Green phase):
   - Write minimal code to pass tests
   - Verify with `npm test`

3. **Refactor** (Refactor phase):
   - Improve code quality without changing behavior
   - Tests should still pass

4. **Commit**:
   ```bash
   git add .
   git commit -m "feat: <phase description>

   - Implemented <component/service>
   - Tests: <test coverage>

   Refs: #001-ai-model-selection"
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test settings.service.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm test -- --watch
```

### Linting and Type Checking

```bash
# Type check
npm run build  # Uses tsc

# Run full validation
npm test && npm run lint
```

## Verification Checklist

Before marking feature complete, verify:

- [ ] All tests pass (>90% coverage for new code)
- [ ] TypeScript strict mode passes (no `any` types)
- [ ] Settings schema accepts `summarizerModel` field
- [ ] Settings service can get/update summarizer model
- [ ] Model fetching service works with OpenRouter API
- [ ] Model fetching falls back to hardcoded list on API failure
- [ ] Model selector component renders and filters models
- [ ] Settings page displays and saves model selection
- [ ] Summary generation uses selected model
- [ ] Summary generation falls back to default if no model selected
- [ ] All functional requirements from spec.md are met
- [ ] Constitution check still passes (privacy, TDD, simplicity)
- [ ] Manual testing in browser works as expected
- [ ] Accessibility: keyboard navigation and screen reader support
- [ ] Error handling: graceful fallbacks for API failures

## Common Pitfalls

### Issue: RxDB Schema Changes Don't Apply

**Solution**: Ensure database version is incremented if you modify schema structure. For optional fields, no version bump needed.

### Issue: Model List Takes Too Long to Load

**Solution**: Verify API call is happening only once on mount. Consider adding loading indicator.

### Issue: Selected Model Not Persisted

**Solution**: Check that `updateSummarizerModel` is called after selection change and that `updatedAt` field is updated.

### Issue: Tests Fail Due to Missing API Key

**Solution**: Mock `fetchModels` in tests to return fake data. Don't make real API calls in unit tests.

## Next Steps

After completing this implementation:

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Follow TDD workflow for each task
3. Create pull request when all tasks complete
4. Request code review with constitution compliance check

## Resources

- [RxDB Documentation](https://rxdb.info/)
- [Zod Schema Validation](https://zod.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Vitest Documentation](https://vitest.dev/)
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Project Constitution](../../../.specify/memory/constitution.md)
