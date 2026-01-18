# Data Model: Daily Journal Chat

**Date**: 2026-01-16 | **Branch**: `001-daily-journal-chat`

## Entity Relationship

```
Settings (1:1, singleton)
  │
  └── [stores encrypted API key, preferences]

Day (1:N from implicit User)
  │
  ├── Message (1:N)
  │
  └── Summary (1:1, optional)
```

## Entities

### Settings

Singleton entity storing user configuration and encrypted credentials.

| Field | Type | Required | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| `id` | string | Yes | No | Always `"settings"` (singleton) |
| `openRouterApiKey` | string | No | **Yes** | User's OpenRouter API key |
| `timezone` | string | Yes | No | User's preferred timezone |
| `setupComplete` | boolean | Yes | No | Has user completed initial setup |
| `createdAt` | number | Yes | No | Unix timestamp of setup |

```typescript
interface Settings {
  id: 'settings';
  openRouterApiKey?: string;  // Encrypted
  timezone: string;           // "America/New_York"
  setupComplete: boolean;     // true after first password setup
  createdAt: number;          // 1737043200000
}
```

---

### Day

Represents a calendar day in the user's local timezone.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Primary key, format: `YYYY-MM-DD` |
| `createdAt` | number | Yes | Unix timestamp of first message |
| `updatedAt` | number | Yes | Unix timestamp of last activity |
| `timezone` | string | Yes | IANA timezone (e.g., `America/New_York`) |
| `hasSummary` | boolean | Yes | Quick lookup for calendar highlighting |

**Indexes**: `createdAt`, `hasSummary`

```typescript
interface Day {
  id: string;           // "2026-01-16"
  createdAt: number;    // 1737043200000
  updatedAt: number;    // 1737072000000
  timezone: string;     // "America/New_York"
  hasSummary: boolean;  // false
}
```

---

### Message

A single exchange in a day's chat conversation.

| Field | Type | Required | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| `id` | string | Yes | No | UUID primary key |
| `dayId` | string | Yes | No | Foreign key to Day.id |
| `role` | enum | Yes | No | `user` or `assistant` |
| `content` | string | Yes | **Yes** | Message text |
| `timestamp` | number | Yes | No | Unix timestamp |
| `categories` | string[] | No | No | Auto-detected: journal, insight, health, dream |

**Indexes**: `dayId`, `timestamp`

```typescript
interface Message {
  id: string;                    // "550e8400-e29b-41d4-a716-446655440000"
  dayId: string;                 // "2026-01-16"
  role: 'user' | 'assistant';
  content: string;               // "I had a great day today..."
  timestamp: number;             // 1737050400000
  categories: Category[];        // ["journal", "health"]
}

type Category = 'journal' | 'insight' | 'health' | 'dream';
```

---

### Summary

AI-generated digest of a day's journal entries.

| Field | Type | Required | Encrypted | Description |
|-------|------|----------|-----------|-------------|
| `id` | string | Yes | No | Primary key, same as Day.id |
| `dayId` | string | Yes | No | Foreign key to Day.id |
| `generatedAt` | number | Yes | No | Unix timestamp of generation |
| `sections.journal` | string | Yes | **Yes** | General journal summary |
| `sections.insights` | string | Yes | **Yes** | Key insights summary |
| `sections.health` | string | Yes | **Yes** | Health observations summary |
| `sections.dreams` | string | Yes | **Yes** | Dream summary |
| `rawContent` | string | Yes | **Yes** | Full summary for AI context |

**Indexes**: `dayId`, `generatedAt`

```typescript
interface Summary {
  id: string;           // "2026-01-16"
  dayId: string;        // "2026-01-16"
  generatedAt: number;  // 1737158400000
  sections: {
    journal: string;    // "User had a productive day..."
    insights: string;   // "Key realization about..."
    health: string;     // "Slept 7 hours, moderate energy"
    dreams: string;     // "No dreams recorded"
  };
  rawContent: string;   // Full concatenated summary
}
```

---

## RxDB Schemas

### Settings Schema

```typescript
export const settingsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 10
    },
    openRouterApiKey: { type: 'string' },
    timezone: {
      type: 'string',
      maxLength: 50
    },
    setupComplete: { type: 'boolean' },
    createdAt: { type: 'number' }
  },
  required: ['id', 'timezone', 'setupComplete', 'createdAt'],
  encrypted: ['openRouterApiKey']
};
```

### Day Schema

```typescript
export const daySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 10  // YYYY-MM-DD
    },
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' },
    timezone: {
      type: 'string',
      maxLength: 50
    },
    hasSummary: { type: 'boolean' }
  },
  required: ['id', 'createdAt', 'updatedAt', 'timezone', 'hasSummary'],
  indexes: ['createdAt', 'hasSummary']
};
```

### Message Schema

```typescript
export const messageSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36  // UUID
    },
    dayId: {
      type: 'string',
      maxLength: 10
    },
    role: {
      type: 'string',
      enum: ['user', 'assistant']
    },
    content: { type: 'string' },
    timestamp: { type: 'number' },
    categories: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['journal', 'insight', 'health', 'dream']
      }
    }
  },
  required: ['id', 'dayId', 'role', 'content', 'timestamp'],
  indexes: ['dayId', 'timestamp'],
  encrypted: ['content']
};
```

### Summary Schema

```typescript
export const summarySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 10
    },
    dayId: {
      type: 'string',
      maxLength: 10
    },
    generatedAt: { type: 'number' },
    sections: {
      type: 'object',
      properties: {
        journal: { type: 'string' },
        insights: { type: 'string' },
        health: { type: 'string' },
        dreams: { type: 'string' }
      },
      required: ['journal', 'insights', 'health', 'dreams']
    },
    rawContent: { type: 'string' }
  },
  required: ['id', 'dayId', 'generatedAt', 'sections', 'rawContent'],
  indexes: ['dayId', 'generatedAt'],
  encrypted: ['sections', 'rawContent']
};
```

---

## Validation Rules

### Day
- `id` must match pattern `^\d{4}-\d{2}-\d{2}$`
- `timezone` must be valid IANA timezone
- `createdAt` <= `updatedAt`

### Message
- `id` must be valid UUID v4
- `dayId` must reference existing Day
- `timestamp` must be within day boundaries (per timezone)
- `content` must not be empty

### Summary
- `id` must equal `dayId` (1:1 relationship)
- `dayId` must reference existing Day with messages
- All section fields required (use "No X recorded" if empty)

---

## State Transitions

### Day Lifecycle
```
[Created] -> First message added
    │
    v
[Active] -> Messages being added (today)
    │
    v
[Past] -> Day ended, can append but typically view-only
    │
    v
[Summarized] -> Summary generated (hasSummary = true)
```

### Summary Generation
```
Day has messages AND day has ended
    │
    v
User triggers "Generate Summary"
    │
    v
AI processes all messages for day
    │
    v
Summary created, Day.hasSummary = true
```
