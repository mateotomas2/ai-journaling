# Research: Daily Journal Chat with AI Summaries

**Date**: 2026-01-16 | **Branch**: `001-daily-journal-chat`

## Technology Decisions

### 1. AI Provider: OpenRouter with GPT-4o

**Decision**: Use OpenRouter API with GPT-4o model via Express proxy server

**Rationale**:
- User explicitly requested OpenRouter instead of Anthropic
- OpenRouter provides unified API compatible with OpenAI's chat completion format
- GPT-4o offers strong conversational and summarization capabilities
- User provides their own API key (privacy-first: no shared credentials)
- Proxy server keeps API key secure (not exposed in browser network requests)

**Key Implementation**:
- Direct fetch to OpenRouter API (no SDK needed)
- Express proxy endpoint at `/api/chat`
- User's API key stored encrypted in IndexedDB, sent per-request

**API Pattern**:
```typescript
// Server-side proxy (server/routes/ai.ts)
router.post('/api/chat', async (req, res) => {
  const { messages, apiKey } = req.body;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://reflekt.app',
      'X-Title': 'Reflekt Journal'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages,
      stream: false
    })
  });
  res.json(await response.json());
});
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Anthropic Claude | User explicitly requested OpenRouter |
| Direct browser-to-OpenRouter | Exposes API key in network requests |
| Local LLM (Ollama) | Requires user hardware; inconsistent quality |
| TanStack AI framework | Adds complexity; direct fetch is simpler for our needs |

---

### 2. Testing Framework: Vitest

**Decision**: Use Vitest with React Testing Library (already configured)

**Rationale**:
- Already set up in project with proper configuration
- Native ES modules support, fast execution
- Jest-compatible API
- First-class TypeScript support
- Integrates with Vite configuration

**Key Packages** (already installed):
- `vitest` - Test runner
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - DOM assertions
- `@testing-library/user-event` - User interaction simulation
- `jsdom` - DOM environment for tests

---

### 3. Storage: RxDB with Encrypted IndexedDB

**Decision**: Use RxDB with password-derived encryption key

**Rationale**:
- **Privacy-First compliance**: All journal data encrypted at rest
- Local-first architecture with IndexedDB backend (already installed)
- Reactive queries via RxJS integration
- Works offline by default
- No cloud sync (local-only per spec)

**Key Implementation**:
- Password-derived key using PBKDF2 (Web Crypto API)
- RxDB encryption plugin with derived key
- Salt stored in localStorage (not secret)
- No recovery if password forgotten (accepted tradeoff)

**Encryption Flow**:
```typescript
// 1. First-time setup: generate salt, derive key from password
const salt = crypto.getRandomValues(new Uint8Array(16));
localStorage.setItem('reflekt_salt', btoa(String.fromCharCode(...salt)));

// 2. Key derivation
const keyMaterial = await crypto.subtle.importKey(
  'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']
);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  true, // extractable to get hex for RxDB
  ['encrypt', 'decrypt']
);

// 3. RxDB database with encryption
const db = await createRxDatabase({
  name: 'reflekt',
  storage: getRxStorageDexie(),
  password: await exportKeyAsHex(key)
});
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| No encryption | Violates privacy-first constitution |
| Fixed key encryption | Anyone with browser access could read data |
| External key management | Requires account system, adds complexity |

---

### 4. Framework: Vite + React

**Decision**: Use Vite with React (already configured)

**Rationale**:
- Already set up in project
- **YAGNI principle**: No need for full-stack framework
- Vite is proven, stable, and fast
- Minimal server needs (just API proxy for OpenRouter)

---

### 5. Daily Summary Generation

**Decision**: Generate summaries via OpenRouter GPT-4o at day-end

**Rationale**:
- AI summarization is core feature (US2)
- Structured sections provide consistent format for historical queries
- Summaries stored separately from chat logs for efficiency

**Trigger Mechanism**:
- Check on app open if previous day(s) need summaries
- Also trigger via visibility change (when user returns after midnight)
- Store `lastSummaryCheck` timestamp to prevent redundant checks

**Summary Prompt**:
```typescript
const SUMMARY_SYSTEM_PROMPT = `You are summarizing a user's daily journal entries.
Create a structured summary with these sections (omit empty sections):

## General Journal
[Key events and reflections - 2-4 bullet points]

## Insights
[Notable realizations or thoughts - 1-3 bullet points]

## Health
[Sleep, energy, physical/mental health - 1-3 bullet points]

## Dreams
[Any dreams described - 1-2 bullet points]

Be concise. Use the user's own words where impactful.`;
```

---

### 6. Historical Query Implementation

**Decision**: Load relevant summaries into GPT-4o context for queries

**Rationale**:
- Summaries are ~10x smaller than full chat logs per day
- 90-day context fits within GPT-4o's 128K token limit
- AI can synthesize patterns and cite specific dates

**Implementation Pattern**:
```typescript
async function queryHistory(question: string, daysBack: number = 90) {
  const summaries = await db.summaries
    .find({ selector: { date: { $gte: subDays(new Date(), daysBack) } } })
    .exec();

  const context = summaries
    .map(s => `## ${s.date}\n${s.content}`)
    .join('\n\n');

  return callOpenRouter([
    { role: 'system', content: `You have the user's journal summaries:\n\n${context}\n\nAnswer questions citing specific dates.` },
    { role: 'user', content: question }
  ]);
}
```

---

### 7. Date/Timezone Handling

**Decision**: Use user's local timezone for all day boundaries

**Rationale**:
- "Day" is user-defined based on local time
- date-fns-tz (already installed) handles timezone conversions
- Store dates as ISO strings for consistency

**Implementation**:
```typescript
function getDayKey(date: Date = new Date()): string {
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatInTimeZone(date, userTz, 'yyyy-MM-dd');
}
```

---

### 8. Offline Behavior

**Decision**: Journal entries work offline; AI features queue until online

**Rationale**:
- Core journaling must not be blocked by network
- RxDB/IndexedDB works fully offline
- AI naturally requires network; queue is acceptable UX

**Implementation**:
```typescript
// Always save locally first
await db.messages.insert({ role: 'user', content, timestamp: Date.now() });

if (!navigator.onLine) {
  return { pending: true, message: 'AI response will appear when online' };
}
// Otherwise call OpenRouter...

window.addEventListener('online', processQueuedAiRequests);
```

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| AI provider? | OpenRouter with GPT-4o (user specified) |
| Encryption key management? | PBKDF2 from user password; salt in localStorage |
| Password recovery? | Not possible; user warned at setup |
| Automatic vs manual summaries? | Automatic at day-end (check on app open) |
| Offline behavior? | Local ops work; AI queued until online |

---

## Dependencies Summary

### Production (from package.json)
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.3 | UI framework |
| react-dom | ^19.2.3 | React DOM renderer |
| react-router-dom | ^7.12.0 | Client-side routing |
| rxdb | ^16.21.1 | Local database with encryption |
| rxjs | ^7.8.2 | Reactive extensions (RxDB peer dep) |
| date-fns | ^4.1.0 | Date manipulation |
| date-fns-tz | ^3.2.0 | Timezone handling |
| express | ^5.2.1 | Minimal API server |
| zod | ^4.3.5 | Schema validation |

### To Remove (replaced by OpenRouter)
| Package | Reason |
|---------|--------|
| @anthropic-ai/sdk | Replaced by direct OpenRouter fetch |
| @tanstack/ai | Not needed; direct fetch is simpler |
| @tanstack/ai-anthropic | Not needed |
| @tanstack/ai-react | Not needed |

### Development (from package.json)
| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.9.3 | Type safety |
| vite | ^7.3.1 | Build tool |
| vitest | ^4.0.17 | Test runner |
| @testing-library/react | ^16.3.1 | React testing |
| @testing-library/jest-dom | ^6.9.1 | DOM assertions |
| @testing-library/user-event | ^14.6.1 | User event simulation |
| jsdom | ^27.4.0 | DOM environment |
