# Data Model: User Settings Management

**Date**: 2026-01-17
**Feature**: User Settings Management

## Overview

The settings feature extends the existing `Settings` entity with new fields and introduces validation schemas for import/export operations. All data remains local-only in encrypted RxDB storage.

## Entities

### Settings (Extended from 001-daily-journal-chat)

**Purpose**: Stores user-configurable application parameters

**Schema Location**: `src/db/schemas/settings.schema.ts`

**Fields**:

| Field | Type | Required | Description | Validation | Default |
|-------|------|----------|-------------|------------|---------|
| `id` | string | Yes | Always "settings" (singleton) | Exact match: "settings" | "settings" |
| `openRouterApiKey` | string | No | Encrypted OpenRouter API key | Min 20 chars, starts with "sk-" | undefined |
| `systemPrompt` | string | No | **NEW** Custom AI system prompt | Max 5000 chars | `""` (empty string; service layer returns `DEFAULT_PROMPT` constant when reading empty value) |
| `timezone` | string | Yes | User timezone | Valid IANA timezone | Browser default |
| `setupComplete` | boolean | Yes | Initial setup done | Boolean | false |
| `createdAt` | number | Yes | Creation timestamp | Unix ms | Current time |

**Indexes**: None (singleton entity)

**Encryption**: `openRouterApiKey` and `systemPrompt` fields encrypted at rest (RxDB handles this)

**Relationships**: None (standalone configuration entity)

**State Transitions**: None (settings are updated in place)

---

### Export Package (Virtual Entity)

**Purpose**: JSON structure for data export/import

**Schema Location**: `src/services/db/import.ts` (Zod validation schema)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Export format version (e.g., "1.0.0") |
| `exportedAt` | string | Yes | ISO 8601 timestamp |
| `days` | Day[] | Yes | Array of Day entities |
| `messages` | Message[] | Yes | Array of Message entities |
| `summaries` | Summary[] | Yes | Array of Summary entities |

**Validation Rules**:
- `version` must match supported schema versions
- `days`, `messages`, `summaries` must validate against their respective Zod schemas
- Import skips duplicates based on entity `id` field
- Invalid entities cause entire import to fail (atomic operation)

**Note**: Export Package is not persisted; it's a serialization format only.

---

## Validation Rules

### API Key Validation

**Location**: `src/services/settings/validation.ts`

**Rules**:
1. Must start with `"sk-"` (OpenRouter convention)
2. Minimum length: 20 characters
3. No whitespace allowed
4. Case-sensitive

**Example Valid Keys**:
- `sk-or-v1-abc123def456...`
- `sk-proj-xyz789...`

**Example Invalid Keys**:
- `sk-` (too short)
- `openrouter_key123` (wrong prefix)
- `sk-test 123` (contains whitespace)

---

### System Prompt Validation

**Location**: `src/services/settings/validation.ts`

**Rules**:
1. Maximum length: 5000 characters
2. Minimum length: 1 character (if provided; can be empty to use default)
3. No validation on content (user can enter any text; AI behavior is their responsibility)

**Default Prompt**: Defined in `src/services/ai/prompts.ts` as `DEFAULT_SYSTEM_PROMPT`

---

### Import Data Validation

**Location**: `src/services/db/import.ts`

**Rules**:
1. Must be valid JSON
2. Must have `version`, `exportedAt`, `days`, `messages`, `summaries` fields
3. Each entity array must validate against respective Zod schema
4. Version must be compatible (exact match for v1.0.0)
5. Duplicate IDs are skipped, not errors

---

## Data Flow Diagrams

### Settings Update Flow

```
User Input → Validation → Settings Service → RxDB → Encrypted Storage
                ↓
            Show Toast (success/error)
```

### Export Flow

```
Settings Page → Export Service → RxDB Query → JSON Serialization → File Download
                                     ↓
                            (days, messages, summaries)
```

### Import Flow

```
File Selection → File Reader → JSON Parse → Zod Validation → Import Service → RxDB Bulk Write
                                                 ↓                                  ↓
                                            Show Errors                     Report Statistics
```

### Clear All Data Flow

```
Settings Page → Confirmation Modal → Type Phrase → Close Database → Clear IndexedDB → Redirect to Setup
                       ↓
                 Cancel = No-op
```

---

## Database Schema Changes

### Required Changes to Existing Schemas

**File**: `src/db/schemas/settings.schema.ts`

**Change**: Add `systemPrompt` field

```typescript
systemPrompt: {
  type: 'string',
  default: '', // Empty string in DB; service layer substitutes DEFAULT_PROMPT constant when reading
}
```

**Migration**: No migration needed; new field is optional with default value

**Implementation Note**: The database stores an empty string by default. The `getSystemPrompt()` service function (in `src/services/settings/settings.service.ts`) will return the `DEFAULT_PROMPT` constant when it reads an empty string from the database. This separation allows users to distinguish between "never customized" (empty string) and "customized to match default" (explicitly set to DEFAULT_PROMPT text).

---

### No Changes Needed

The following schemas remain unchanged:
- `day.schema.ts` - No changes
- `message.schema.ts` - No changes
- `summary.schema.ts` - No changes

---

## TypeScript Type Definitions

### Settings Interface (Updated)

**Location**: `src/types/entities.ts`

```typescript
export interface Settings {
  id: 'settings';
  openRouterApiKey?: string;
  systemPrompt?: string; // NEW
  timezone: string;
  setupComplete: boolean;
  createdAt: number;
}
```

### Import/Export Types (Already Defined in 001)

**Location**: `src/services/db/import.ts`

Types already exist from 001-daily-journal-chat:
- `ImportData` (Zod-inferred type)
- `ImportResult` (statistics interface)

---

## Constraints and Invariants

### Global Constraints
1. **Singleton Settings**: Only one Settings entity exists (id = "settings")
2. **Encryption**: OpenRouter API key and system prompt are always encrypted at rest
3. **Offline-First**: All settings operations work without network connectivity
4. **Atomic Updates**: Settings updates are transactional (all-or-nothing)

### Field Constraints
1. **API Key**: Optional but if provided, must be valid format
2. **System Prompt**: Optional; empty string means use default
3. **Timezone**: Must be valid IANA timezone string

### Business Rules
1. **Clear All Data**: Irreversible; requires explicit confirmation
2. **Import Duplicates**: Skipped silently; user receives statistics on skipped count
3. **Export Always Succeeds**: Even empty database exports valid JSON (with empty arrays)

---

## Performance Considerations

### Settings Load
- **Expected**: <50ms (singleton read from IndexedDB)
- **Worst Case**: <200ms (first load with cold cache)

### Export Operation
- **Expected**: <5 seconds for 1 year of daily data (~365 days, ~3650 messages, ~365 summaries)
- **Worst Case**: <10 seconds for 5 years of data

### Import Operation
- **Expected**: <15 seconds for 1 year of data
- **Worst Case**: <30 seconds for 5 years of data

### Clear All Data
- **Expected**: <2 seconds (close DB, clear IndexedDB, redirect)
- **Worst Case**: <5 seconds (if browser is slow to release locks)

---

## Security Notes

1. **API Key Encryption**: Handled automatically by RxDB encryption layer (AES-GCM)
2. **System Prompt Encryption**: Also encrypted; prevents exposure in browser dev tools
3. **Export File**: Contains encrypted data; readable only when imported back into app with correct password
4. **Clear Data**: Ensures complete removal (not just marking deleted); IndexedDB fully cleared

---

## Summary

This data model extends the existing Settings entity with minimal changes:
- Add `systemPrompt` field (optional, encrypted)
- Reuse existing export/import schemas from 001
- No new database collections required
- All operations remain local and encrypted

Next: Define API contracts (internal service interfaces, not REST APIs since this is client-side only).
