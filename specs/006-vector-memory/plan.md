# Implementation Plan: AI Vector Memory for Journal Context

**Branch**: `006-vector-memory` | **Date**: 2026-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-vector-memory/spec.md`

## Deprecation Notice

**Date**: 2026-01-25

**Change**: The automatic context retrieval feature (User Story 1) has been removed from this implementation. The following components have been deleted:

- `src/components/chat/MemoryContext.tsx` - Automatic context display component
- `src/hooks/useContextRetrieval.ts` - Automatic context retrieval hook
- `src/services/memory/retrieval.ts` - Retrieval utility functions
- `MemoryService.getRelevantContext()` method from `src/services/memory/search.ts`

**Preserved Features**: Manual memory search (User Story 2) and pattern analysis (User Story 3) remain fully functional. All vector memory infrastructure (embedding generation, indexing, similarity search) continues to work and powers the manual search feature.

**Alternative**: Users can use the manual search feature (Cmd+K / Ctrl+K) to explicitly search for and reference past journal entries when needed, providing similar functionality with explicit user control.

## Summary

This feature implements a semantic memory system that enables users to search their journal history using natural language queries. The system converts journal messages into vector embeddings using local (client-side) transformer models, stores them in an encrypted IndexedDB collection, and performs similarity search to find contextually relevant entries. The implementation prioritizes privacy (all processing local, no data sent to external services) while providing cross-chat search awareness.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode enabled)
**Primary Dependencies**: React 19.2, RxDB 16.21 (IndexedDB), Zod 4.3, [NEEDS CLARIFICATION: local embedding library - transformers.js, onnxruntime-web, or similar]
**Storage**: RxDB with IndexedDB (Dexie adapter), encrypted with crypto-js plugin (existing setup)
**Testing**: Vitest 4.0.17 with @testing-library/react 16.3.1 and jsdom 27.4.0
**Target Platform**: Web browser (modern browsers with IndexedDB and WebAssembly support)
**Project Type**: Web application (single-page React app with Express API server)
**Performance Goals**:
  - Embedding generation: <3 seconds per message on modern hardware
  - Similarity search: <2 seconds for databases up to 1000 entries
  - UI remains responsive during embedding operations (use Web Workers)
**Constraints**:
  - All embedding generation MUST occur client-side (no external API calls for privacy)
  - Vector data MUST be encrypted at rest using existing RxDB encryption
  - [NEEDS CLARIFICATION: embedding model selection - balance between model size, quality, and browser compatibility]
  - [NEEDS CLARIFICATION: vector index structure - flat storage with brute-force search vs. approximate nearest neighbor (ANN) approach]
  - [NEEDS CLARIFICATION: chunking strategy for long messages - split long entries or embed as-is with truncation]
**Scale/Scope**:
  - Support 1000+ journal entries without significant performance degradation
  - Vector embeddings typically 384-768 dimensions depending on model
  - ~1.5-3KB storage per embedded message (vector + metadata)
  - Expected DB growth: ~2-3MB per 1000 messages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Privacy-First ✅ PASS

- **All journal data MUST be encrypted at rest**: Using existing RxDB encryption (crypto-js) for both message content and vector embeddings
- **Local-first storage**: Vector embeddings stored in IndexedDB alongside messages, no cloud dependency
- **No telemetry/analytics without consent**: Feature adds no tracking or external calls
- **Third-party services MUST NOT receive content**: Embeddings generated locally using browser-based ML models (transformers.js or similar)
- **AI processing SHOULD occur locally**: ✅ Embeddings generated in browser using WebAssembly/ONNX runtime
- **Data deletion honored**: Vector embeddings deleted when corresponding messages are deleted (cascading cleanup)

### II. Test-Driven Development ✅ PASS (with plan)

- Tests will be written before implementation (TDD cycle)
- Test coverage targets:
  - Unit tests: Embedding generation, similarity calculation, vector storage/retrieval
  - Integration tests: Message-to-embedding pipeline, search accuracy, encryption validation
  - Component tests: Search UI, context display in chat
- Critical path coverage target: >90% for embedding pipeline and encryption

### III. Simplicity (YAGNI) ✅ PASS (with justification)

- **Current validated need**: User requests context-aware AI conversations across journal history
- **Complexity introduced**:
  - New dependency: Local embedding library (~5-10MB model, well-established library)
  - New RxDB collection: `embeddings` (justified - separate concern from messages)
  - Vector similarity computation: Standard cosine similarity (well-understood algorithm)
- **Alternatives considered**:
  - Keyword search: Insufficient - misses semantic relationships
  - Full LLM context: Privacy violation + cost prohibitive
  - Cloud embedding APIs: Privacy violation
- **Complexity justified**: Semantic search requires vector embeddings; no simpler solution meets privacy requirements

### IV. UI Framework (Tailwind CSS + shadcn/ui) ✅ PASS

- Manual search interface will use shadcn/ui components (Command, Dialog, Input)
- Context display in chat uses Tailwind utility classes
- No custom CSS required beyond existing design tokens

---

## Post-Design Constitution Re-check

*Re-evaluation after Phase 0 research and Phase 1 design completion*

### I. Privacy-First ✅ PASS (Confirmed)

**Design Decisions Aligned with Privacy**:
- ✅ Embedding library selected: `@xenova/transformers` - runs 100% locally, no network calls after model download
- ✅ Model selected: all-MiniLM-L6-v2 (22MB) - downloaded once from HuggingFace CDN, then cached in browser
- ✅ Embeddings encrypted: `encrypted: ['vector']` in schema, using existing crypto-js integration
- ✅ Web Worker isolation: Embedding generation happens off main thread, no data leakage
- ✅ No external services: All search/indexing operations local to browser

**Potential Privacy Considerations Addressed**:
- Model download from HuggingFace CDN is one-time, cached locally
- No telemetry in @xenova/transformers library
- Vector embeddings are mathematical representations, but still encrypted at rest for maximum privacy

### II. Test-Driven Development ✅ PASS (Detailed Plan)

**Test Strategy Defined**:
- Unit tests: `embedding-generator.test.ts`, `similarity-search.test.ts`, `indexer.test.ts`
- Integration tests: `memory-pipeline.test.ts`, `encryption.test.ts`
- Component tests: `MemorySearch.test.tsx`, `MemoryContext.test.tsx`
- Contract tests: Verify all interface implementations satisfy contracts
- Test examples provided in `quickstart.md`

**TDD Workflow**:
1. Write failing tests for each interface (`IEmbeddingService`, `IMemoryService`, etc.)
2. Implement minimal code to pass tests
3. Refactor while maintaining green tests
4. Target >90% coverage for embedding pipeline and encryption

### III. Simplicity (YAGNI) ✅ PASS (Validated)

**Simplicity Maintained**:
- ✅ Started with flat/brute-force search (simple, exact, fast enough for 1000 entries)
- ✅ No premature ANN optimization - defer EdgeVec until >5000 entries or user reports slowness
- ✅ Simple chunking strategy: embed entire message if ≤256 tokens, otherwise sliding window with averaging
- ✅ Single dependency: @xenova/transformers (~148KB, well-established)
- ✅ No custom abstractions beyond necessary interfaces

**Complexity Justified** (from Complexity Tracking table):
1. New dependency (~10MB model): Required for local embeddings, no simpler alternative
2. New RxDB collection: Proper separation of concerns, avoids coupling with Message entity

**Future Complexity Deferred**:
- ANN search (EdgeVec): Only if performance becomes issue
- Chunk-level embeddings: Only if relevance issues reported
- Multi-model support: Only if model upgrade needed

### IV. UI Framework (Tailwind CSS + shadcn/ui) ✅ PASS (Components Identified)

**shadcn/ui Components to Use**:
- `Command` component for search command palette (manual search)
- `Dialog` component for search results display
- `Input` component for search query
- `Card` component for context display in chat
- `Badge` component for similarity scores

**Tailwind Classes**:
- Standard utility classes for layout, spacing, colors
- No custom CSS required
- Dark mode support via `dark:` variant (existing pattern)

**Compliance**:
- ✅ All components extend shadcn/ui patterns
- ✅ No inline `style` attributes
- ✅ Design tokens defined in existing `tailwind.config.js`

---

**GATE STATUS**: ✅ ALL CHECKS PASS - Ready for Phase 2 (tasks generation)

## Project Structure

### Documentation (this feature)

```text
specs/006-vector-memory/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (embedding libraries, vector search patterns)
├── data-model.md        # Phase 1 output (Embedding entity, relationships)
├── quickstart.md        # Phase 1 output (developer guide for vector memory)
├── contracts/           # Phase 1 output (search API, embedding pipeline interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── chat/
│   │   └── MemoryContext.tsx         # Display relevant past entries in chat
│   └── search/
│       ├── MemorySearch.tsx          # Manual memory search dialog
│       └── SearchResults.tsx         # Search result display component
├── db/
│   └── schemas/
│       └── embedding.schema.ts       # RxDB schema for vector embeddings
├── services/
│   ├── embedding/
│   │   ├── generator.ts              # Generate embeddings from text
│   │   ├── worker.ts                 # Web Worker for off-thread embedding
│   │   └── models.ts                 # Model loading and management
│   └── memory/
│       ├── search.ts                 # Similarity search implementation
│       ├── indexer.ts                # Index messages as embeddings
│       └── retrieval.ts              # Retrieve relevant context for queries
├── hooks/
│   ├── useMemorySearch.ts            # Hook for manual search
│   └── useContextRetrieval.ts        # Hook for automatic context during chat
└── types/
    └── entities.ts                   # Add Embedding type

server/
└── (no changes - embeddings purely client-side)

tests/
├── unit/
│   ├── embedding-generator.test.ts   # Embedding generation tests
│   ├── similarity-search.test.ts     # Vector similarity tests
│   └── indexer.test.ts               # Message indexing tests
├── integration/
│   ├── memory-pipeline.test.ts       # End-to-end embedding → search flow
│   └── encryption.test.ts            # Verify vector encryption
└── component/
    ├── MemorySearch.test.tsx         # Search UI tests
    └── MemoryContext.test.tsx        # Context display tests
```

**Structure Decision**: Web application with single-page React frontend. Vector memory is entirely client-side, so no server changes needed. Added `embedding/` and `memory/` service directories to separate ML concerns from business logic, following existing pattern of domain-specific service folders.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New dependency (embedding library ~10MB) | Local embedding generation requires ML model running in browser | Keyword search cannot capture semantic meaning; cloud APIs violate privacy-first principle |
| New RxDB collection (`embeddings`) | Vectors are separate concern with different schema/lifecycle from messages | Storing embeddings in message documents would violate single responsibility and complicate migrations |
