# Research: AI Vector Memory Implementation

**Date**: 2026-01-18
**Feature**: 006-vector-memory
**Purpose**: Resolve technical unknowns for browser-based semantic search

## Overview

This document consolidates research findings for implementing client-side vector embeddings in a privacy-focused journaling web app. All decisions prioritize local-first processing, privacy, and simplicity while maintaining acceptable performance.

## Decision 1: Embedding Library

**Decision**: Use **@xenova/transformers** (Transformers.js)

**Rationale**:
- Runs completely locally with no network calls after initial model download
- Official Hugging Face project with strong maintenance (v3 released 2024)
- Superior browser support via ONNX Runtime with WebAssembly fallback
- WebGPU support provides 10x performance boost on compatible browsers
- Simple API: `pipeline("feature-extraction")` abstraction
- Small core bundle: ~148KB gzipped
- 70-80% WebGPU browser support in 2026 (Chrome 113+, Firefox 141+, Safari 26+)

**Alternatives Considered**:
- **onnxruntime-web**: Lower-level API, more complex integration, less documentation
- **tensorflow.js**: Larger bundle size (~200KB), slower embedding performance, fewer pre-converted models
- **Custom WASM**: Too complex, violates YAGNI, would require maintaining model conversion pipeline

**Installation**:
```bash
npm install @xenova/transformers
```

**Integration Pattern**:
```typescript
import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = true;

const embedder = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2',
  { device: 'webgpu', dtype: 'q8' }
);
```

## Decision 2: Embedding Model

**Decision**: Use **all-MiniLM-L6-v2** (via Xenova/all-MiniLM-L6-v2)

**Rationale**:
- Optimal size/quality tradeoff: 22MB download, 384-dimension output
- Fast performance: 20-50ms per embedding on WebGPU, 50-150ms on WebAssembly
- Good semantic accuracy: 84-85% on STS-B benchmark (vs 87-88% for 5x larger models)
- Browser-optimized: Quantized ONNX version specifically for Transformers.js
- Industry standard for edge/browser deployments
- Max sequence length: 256 tokens (~200 words) - sufficient for most journal entries

**Model Specifications**:
- Dimensions: 384
- Parameters: 22M
- Download size: 22MB (one-time, cached in browser)
- Max tokens: 256
- Quality: Good for semantic similarity (not perfect, but privacy tradeoff justified)

**Alternatives Considered**:
- **all-mpnet-base-v2**: 768 dimensions, better accuracy (87-88%), but 5x slower and ~420MB - violates simplicity, overkill for journaling
- **Smaller models** (<100MB): Significantly worse accuracy, not worth the marginal size savings
- **Multilingual models**: Unnecessary complexity for English-first app

**Performance Expectations**:
- First embedding after page load: ~200ms (model initialization)
- Subsequent embeddings: 20-50ms (WebGPU), 50-150ms (WASM)
- Total memory: 22MB model + 1.5KB per embedded entry

## Decision 3: Vector Index Structure

**Decision**: Start with **flat storage + brute-force cosine similarity**, migrate to **EdgeVec** if needed

**Phase 1 (MVP, <5000 entries)**: Flat Storage

**Rationale**:
- Simple, exact results, easy to debug and test
- 1000 entries × 384 dimensions = ~1.5MB in memory
- Modern browsers compute 1000 cosine similarities in <5ms
- No additional dependencies, works everywhere
- Meets spec requirement: "search results return in under 2 seconds for 1000 entries" (actual: <5ms)

**Implementation**:
```typescript
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function findSimilar(queryEmbedding: Float32Array, entries: Entry[], topK = 5) {
  const scores = entries.map(entry => ({
    entry,
    score: cosineSimilarity(queryEmbedding, new Float32Array(entry.embedding))
  }));
  return scores.sort((a, b) => b.score - a.score).slice(0, topK);
}
```

**Phase 2 (>5000 entries, if needed)**: EdgeVec (ANN)

**When to migrate**:
- Search latency exceeds 50ms
- User has >5000 journal entries
- User feedback indicates perceived slowness

**Library**: EdgeVec (Rust/WASM ANN library)
- 24x faster than flat search for large datasets (0.5ms vs 12ms)
- 32x memory reduction via binary quantization
- Sub-millisecond search with 1000+ entries
- Only 148KB gzipped bundle size
- Metadata filtering built-in

**Why not immediate ANN**:
- Violates YAGNI - adds complexity before it's needed
- Most users unlikely to have >5000 entries
- Flat search meets all performance requirements for target scale
- Easier testing and debugging with exact search

## Decision 4: Chunking Strategy

**Decision**: Hybrid approach based on entry length

**For entries ≤256 tokens (~200 words)**: Embed entire entry as-is
- Model truncates automatically to 256 tokens
- Most journal entries fall in this range
- Single embedding is simpler and higher quality than chunk aggregation

**For entries >256 tokens**: Sliding window with 20% overlap + averaging
- Chunk size: 200 tokens (leaves margin below 256 max)
- Overlap: 40 tokens (20%) to preserve context at boundaries
- Embed each chunk separately
- Average embeddings to create document-level representation
- Normalize final averaged vector

**Rationale**:
- Simplest approach that handles edge cases
- Research shows embedding averaging is effective for document-level representation
- Overlap prevents semantic breaks at chunk boundaries
- Chunk-level embeddings can be added later if needed (store separately with parent reference)

**Implementation**:
```typescript
async function embedEntry(text: string): Promise<Float32Array> {
  const tokens = await tokenizer(text);

  // Short entry: embed as-is
  if (tokens.length <= 256) {
    const result = await embedder(text, {
      pooling: 'mean',
      normalize: true,
      truncation: true
    });
    return new Float32Array(result.data);
  }

  // Long entry: chunk with overlap
  const chunkSize = 200, overlap = 40;
  const chunks: string[] = [];

  for (let i = 0; i < tokens.length; i += chunkSize - overlap) {
    const chunkTokens = tokens.slice(i, i + chunkSize);
    chunks.push(tokenizer.decode(chunkTokens));
  }

  // Embed and average
  const embeddings = await Promise.all(
    chunks.map(async chunk => {
      const result = await embedder(chunk, { pooling: 'mean', normalize: true });
      return new Float32Array(result.data);
    })
  );

  const avgEmbedding = new Float32Array(384);
  for (const emb of embeddings) {
    for (let i = 0; i < 384; i++) {
      avgEmbedding[i] += emb[i] / embeddings.length;
    }
  }

  // Normalize
  const norm = Math.sqrt(avgEmbedding.reduce((sum, val) => sum + val * val, 0));
  for (let i = 0; i < 384; i++) {
    avgEmbedding[i] /= norm;
  }

  return avgEmbedding;
}
```

**Alternative for very long entries (future optimization)**:
- Store chunk embeddings separately with parent entry reference
- Search chunks, return parent entries
- Better for pinpointing specific passages
- Only implement if users report relevance issues with long entries

## Best Practices from Research

### Web Worker Architecture

**Key Principle**: Keep main thread responsive during embedding generation

```typescript
// embedding.worker.ts
import { pipeline } from '@xenova/transformers';

let embedder: any = null;

self.addEventListener('message', async (e) => {
  const { type, text, id } = e.data;

  if (type === 'init') {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { device: 'webgpu', dtype: 'q8' }
    );
    self.postMessage({ type: 'ready' });
  }

  if (type === 'embed') {
    const embedding = await embedder(text, {
      pooling: 'mean',
      normalize: true,
      truncation: true,
      max_length: 256
    });
    self.postMessage({
      type: 'embedding',
      id,
      embedding: embedding.data
    });
  }
});
```

### RxDB Storage Pattern

**Storage**: Store embeddings as number arrays (RxDB serializes to JSON)
**Encryption**: Embeddings encrypted via existing RxDB crypto-js integration

```typescript
// embedding.schema.ts
export const embeddingSchema: RxJsonSchema<Embedding> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    messageId: { type: 'string', maxLength: 36 },
    vector: {
      type: 'array',
      items: { type: 'number' },
      minItems: 384,
      maxItems: 384
    },
    createdAt: { type: 'number' }
  },
  required: ['id', 'messageId', 'vector', 'createdAt'],
  indexes: ['messageId'],
  encrypted: ['vector'], // Encrypt vectors at rest
};
```

**Conversion Pattern**:
```typescript
// Storage: Float32Array → Array
await embeddingsCollection.insert({
  id: crypto.randomUUID(),
  messageId: message.id,
  vector: Array.from(embedding),
  createdAt: Date.now()
});

// Retrieval: Array → Float32Array
const doc = await embeddingsCollection.findOne(id).exec();
const embedding = new Float32Array(doc.vector);
```

## Performance Budget

| Operation | Target | Expected (WebGPU) | Expected (WASM) |
|-----------|--------|-------------------|-----------------|
| Model download | One-time | 22MB (~3s on avg connection) | Same |
| First embedding | <500ms | ~200ms | ~500ms |
| Subsequent embeddings | <100ms | 20-50ms | 50-150ms |
| Search 1000 entries | <2000ms | <5ms | <5ms |
| UI responsiveness | No blocking | ✅ (Web Worker) | ✅ (Web Worker) |
| Memory footprint | <50MB | 22MB model + 1.5MB/1000 entries | Same |

## Migration Path

1. **Phase 1 (MVP)**: Transformers.js + flat storage + simple chunking
2. **Phase 2**: Monitor search performance as entry count grows
3. **Phase 3** (only if >5000 entries or latency >50ms): Migrate to EdgeVec ANN
4. **Phase 4** (only if relevance issues reported): Add chunk-level embedding storage

## Privacy & Security Notes

- ✅ All embedding generation occurs in browser (no external API calls)
- ✅ Model loaded from HuggingFace CDN on first use, then cached in browser storage
- ✅ Embeddings encrypted at rest via RxDB crypto-js (same as message content)
- ✅ No telemetry or usage tracking
- ✅ Vector data stays local, never transmitted

## Dependencies Summary

| Dependency | Version | Size (gzipped) | Purpose |
|------------|---------|----------------|---------|
| @xenova/transformers | Latest | ~148KB | Embedding generation |
| all-MiniLM-L6-v2 (model) | - | 22MB (cached) | Pre-trained embedding model |
| EdgeVec (future) | Latest | ~148KB | ANN search (only if needed) |

**Total bundle impact**: ~148KB (model downloaded separately, cached)
