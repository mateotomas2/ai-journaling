# Data Model: AI Vector Memory

**Feature**: 006-vector-memory
**Date**: 2026-01-18
**Purpose**: Define entities, relationships, and validation rules for vector memory system

## Overview

The vector memory system introduces one new entity (`Embedding`) and extends the existing schema to support semantic search across journal entries. The model maintains a 1:1 relationship between messages and their vector embeddings, with lifecycle management ensuring consistency.

## Entity: Embedding

**Purpose**: Stores vector representations of journal message content for semantic similarity search

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | string | UUID, primary key, max 36 chars | Unique identifier for the embedding |
| `messageId` | string | UUID, foreign key, max 36 chars, indexed | References the message this embedding represents |
| `vector` | number[] | Array of 384 floats, encrypted | The embedding vector (384 dimensions from all-MiniLM-L6-v2) |
| `modelVersion` | string | Format: "model-name@version" | Tracks which model generated this embedding for migration support |
| `createdAt` | number | Unix timestamp (milliseconds) | When the embedding was generated |

### Validation Rules

- `id`: Must be valid UUID v4
- `messageId`: Must reference an existing message in the `messages` collection
- `vector`: Must contain exactly 384 numeric values between -1 and 1 (normalized)
- `modelVersion`: Must follow format "all-MiniLM-L6-v2@v0" (allows future model upgrades)
- `createdAt`: Must be positive integer, reasonable timestamp (after 2020-01-01)

### RxDB Schema

```typescript
import type { RxJsonSchema } from 'rxdb';

export interface Embedding {
  id: string;
  messageId: string;
  vector: number[]; // Stored as array, converted to Float32Array for computation
  modelVersion: string;
  createdAt: number;
}

export const embeddingSchema: RxJsonSchema<Embedding> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36,
    },
    messageId: {
      type: 'string',
      maxLength: 36,
    },
    vector: {
      type: 'array',
      items: {
        type: 'number',
        minimum: -1,
        maximum: 1,
      },
      minItems: 384,
      maxItems: 384,
    },
    modelVersion: {
      type: 'string',
      pattern: '^[a-zA-Z0-9\\-]+@v\\d+$',
      maxLength: 50,
    },
    createdAt: {
      type: 'number',
      multipleOf: 1,
      minimum: 1577836800000, // 2020-01-01
      maximum: 4102444799999, // 2099-12-31
    },
  },
  required: ['id', 'messageId', 'vector', 'modelVersion', 'createdAt'],
  indexes: ['messageId', 'createdAt'],
  encrypted: ['vector'], // Encrypt vectors at rest using existing RxDB encryption
  additionalProperties: false,
};
```

## Relationships

### Message → Embedding (1:1)

- Each `Message` has exactly zero or one `Embedding`
- Each `Embedding` belongs to exactly one `Message`
- Relationship managed via `messageId` foreign key

**Lifecycle Rules**:
- When a `Message` is created, an `Embedding` SHOULD be generated asynchronously
- When a `Message` is deleted, its corresponding `Embedding` MUST be deleted (cascade)
- When a `Message` content is updated, its `Embedding` SHOULD be regenerated
- Embedding generation is non-blocking (happens in background Web Worker)

**Orphan Handling**:
- Orphaned embeddings (messageId references non-existent message) should be detected and cleaned up periodically
- Missing embeddings (message exists but no embedding) should be detected and generated on-demand during search

### Day → Message → Embedding (1:N:N)

- Each `Day` has many `Messages` (existing relationship)
- Each `Message` has zero or one `Embedding` (new relationship)
- Transitive relationship: `Day` indirectly has many `Embeddings` through `Messages`

**Query Pattern**:
```typescript
// Get all embeddings for a specific day
const day = await db.days.findOne(dayId).exec();
const messages = await db.messages.find({ selector: { dayId: day.id } }).exec();
const messageIds = messages.map(m => m.id);
const embeddings = await db.embeddings.find({
  selector: { messageId: { $in: messageIds } }
}).exec();
```

## State Transitions

### Embedding Lifecycle

```
Message Created
    ↓
[pending] → Embedding queued for generation
    ↓
[generating] → Web Worker processing text
    ↓
[ready] → Embedding stored in DB
    ↓
Message Updated → [regenerating] → [ready]
    ↓
Message Deleted → [deleted] (cascade)
```

**States** (implicit, tracked via existence and metadata):
- **Pending**: Message exists, no embedding record
- **Generating**: Embedding record created with temporary placeholder vector
- **Ready**: Embedding record has valid 384-dimension vector
- **Regenerating**: Message updated, embedding being recalculated
- **Deleted**: Message deleted, embedding removed

**State Detection**:
```typescript
// Pending: message exists but no embedding
const hasPendingEmbedding = async (messageId: string) => {
  const message = await db.messages.findOne(messageId).exec();
  const embedding = await db.embeddings.findOne({ selector: { messageId } }).exec();
  return message && !embedding;
};

// Ready: embedding exists with valid vector
const isReady = async (messageId: string) => {
  const embedding = await db.embeddings.findOne({ selector: { messageId } }).exec();
  return embedding && embedding.vector.length === 384;
};
```

## Extended Entity: Message (no schema changes)

No changes to the `Message` entity schema. Relationship is one-way (Embedding → Message) to avoid coupling and maintain backward compatibility.

**Indirect Relationship Queries**:
```typescript
// Find message by embedding similarity (search pattern)
const similarEmbeddings = await findSimilarEmbeddings(queryVector, topK);
const messageIds = similarEmbeddings.map(e => e.messageId);
const messages = await db.messages.find({
  selector: { id: { $in: messageIds } }
}).exec();
```

## Indexes

### Primary Index
- `id` (primary key): O(1) lookup by embedding ID

### Foreign Key Index
- `messageId`: O(log n) lookup of embedding by message ID
- Supports cascade deletion and update operations
- Enables efficient orphan detection

### Timestamp Index
- `createdAt`: O(log n) range queries for embeddings by date
- Supports cleanup of old embeddings during model migrations
- Enables "recently embedded" queries for debugging

### No Vector Index (Phase 1)
- Vectors not indexed for ANN search in Phase 1 (using flat/brute-force search)
- If migrating to EdgeVec (Phase 2), vector index would be maintained outside RxDB

## Data Integrity Rules

### Referential Integrity
1. `messageId` MUST reference an existing `messages` document
2. Deleting a `messages` document MUST cascade to delete corresponding `embeddings` document
3. Orphaned embeddings (messageId doesn't exist) MUST be cleaned up periodically

### Vector Integrity
1. `vector` array MUST contain exactly 384 numbers
2. All vector values MUST be between -1 and 1 (normalized embedding constraint)
3. Vector MUST represent a valid normalized vector (sum of squares ≈ 1.0 within 0.01 tolerance)

### Model Version Integrity
1. All embeddings MUST have a `modelVersion` field
2. When embedding model changes, old embeddings SHOULD be marked for regeneration
3. Search SHOULD only use embeddings from same model version (or handle mixed versions gracefully)

### Validation Implementation

```typescript
// Custom validator for normalized vector
function isNormalizedVector(vector: number[]): boolean {
  if (vector.length !== 384) return false;

  const sumOfSquares = vector.reduce((sum, val) => {
    if (val < -1 || val > 1) return NaN; // Out of range
    return sum + val * val;
  }, 0);

  // Should be ≈ 1.0 for normalized vector (allow small floating point error)
  return Math.abs(sumOfSquares - 1.0) < 0.01;
}

// Usage in service layer before insert
export async function storeEmbedding(
  messageId: string,
  vector: Float32Array
): Promise<void> {
  const vectorArray = Array.from(vector);

  if (!isNormalizedVector(vectorArray)) {
    throw new Error('Invalid embedding vector: not normalized');
  }

  await db.embeddings.insert({
    id: crypto.randomUUID(),
    messageId,
    vector: vectorArray,
    modelVersion: 'all-MiniLM-L6-v2@v0',
    createdAt: Date.now(),
  });
}
```

## Storage Estimates

### Single Embedding
- `id`: 36 bytes (UUID string)
- `messageId`: 36 bytes (UUID string)
- `vector`: 384 floats × 8 bytes = 3,072 bytes (stored as JSON numbers)
- `modelVersion`: ~20 bytes
- `createdAt`: 8 bytes
- **Subtotal**: ~3,172 bytes per embedding

### Encryption Overhead
- RxDB crypto-js adds ~10-15% encryption overhead
- **Estimated**: ~3,600 bytes per embedding (with encryption)

### Scale Projections
| Entry Count | Raw Size | Encrypted Size | With Indexes |
|-------------|----------|----------------|--------------|
| 100 entries | 310 KB | 350 KB | ~400 KB |
| 1,000 entries | 3.1 MB | 3.5 MB | ~4 MB |
| 5,000 entries | 15.5 MB | 17.5 MB | ~20 MB |
| 10,000 entries | 31 MB | 35 MB | ~40 MB |

**Note**: IndexedDB storage limits are typically 50-100 GB in modern browsers, so even 10,000 entries (40MB) is well within limits.

## Migration Strategy

### Initial Deployment (v0)
- Create `embeddings` collection with schema version 0
- Embed existing messages in background job (non-blocking)
- New messages embedded automatically on creation

### Model Upgrade (future v1)
If switching to a different embedding model:
1. Add `targetModelVersion` field to schema
2. Mark all existing embeddings for regeneration: `needsRegeneration: true`
3. Background job regenerates embeddings with new model
4. Once complete, remove `needsRegeneration` flag
5. Increment schema version

### Backward Compatibility
- Search gracefully handles missing embeddings (excludes from results)
- Mixed model versions: Compare only embeddings from same model
- Schema version increment triggers automatic migration via RxDB migration plugin

## Example Queries

### Create Embedding
```typescript
await db.embeddings.insert({
  id: crypto.randomUUID(),
  messageId: 'abc-123',
  vector: Array.from(embeddingVector),
  modelVersion: 'all-MiniLM-L6-v2@v0',
  createdAt: Date.now(),
});
```

### Find Embedding by Message
```typescript
const embedding = await db.embeddings.findOne({
  selector: { messageId: 'abc-123' }
}).exec();
```

### Get All Embeddings for Search
```typescript
const allEmbeddings = await db.embeddings.find().exec();
const vectors = allEmbeddings.map(doc => ({
  messageId: doc.messageId,
  vector: new Float32Array(doc.vector),
}));
```

### Delete Cascade (Manual Implementation)
```typescript
// When deleting a message, also delete its embedding
await db.messages.findOne(messageId).remove();
await db.embeddings.find({ selector: { messageId } }).remove();
```

### Cleanup Orphaned Embeddings
```typescript
const embeddings = await db.embeddings.find().exec();
for (const embedding of embeddings) {
  const message = await db.messages.findOne(embedding.messageId).exec();
  if (!message) {
    await embedding.remove(); // Orphaned, delete
  }
}
```

## Performance Considerations

### Batch Insert
For initial embedding of existing messages:
```typescript
// Batch insert for better performance
const embeddingDocs = messages.map(msg => ({
  id: crypto.randomUUID(),
  messageId: msg.id,
  vector: Array.from(embeddings[msg.id]),
  modelVersion: 'all-MiniLM-L6-v2@v0',
  createdAt: Date.now(),
}));

await db.embeddings.bulkInsert(embeddingDocs);
```

### Lazy Loading
- Don't load all vectors into memory at once
- Query embeddings only when search is performed
- Use RxDB's streaming queries for large result sets

### Index Usage
- `messageId` index: Speeds up cascade deletes and lookups
- `createdAt` index: Enables efficient cleanup queries
- Composite index not needed (low cardinality queries)
