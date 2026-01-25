# Tasks: AI Vector Memory for Journal Context

**Input**: Design documents from `/specs/006-vector-memory/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Following TDD approach - tests written and failing before implementation (per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths based on plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [x] T001 Install @xenova/transformers dependency via npm
- [x] T002 Add Embedding type to src/types/entities.ts
- [x] T003 [P] Create src/services/embedding/ directory structure
- [x] T004 [P] Create src/services/memory/ directory structure
- [x] T005 [P] Create src/components/search/ directory structure
- [x] T006 [P] Create src/components/chat/ subdirectory (if not exists)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema & Core Services

- [x] T007 Create embedding.schema.ts in src/db/schemas/ with RxDB schema for Embedding entity (id, messageId, vector, modelVersion, createdAt)
- [x] T008 Register embeddings collection in src/db/index.ts with encryption enabled
- [x] T009 Create TypeScript interfaces in specs/006-vector-memory/contracts/embedding-service.ts (IEmbeddingService, EmbeddingResult, EmbeddingServiceConfig)
- [x] T010 [P] Create TypeScript interfaces in specs/006-vector-memory/contracts/memory-service.ts (IMemoryService, MemorySearchQuery, MemorySearchResult)
- [x] T011 [P] Create TypeScript interfaces in specs/006-vector-memory/contracts/hooks.ts (IUseMemorySearch, IUseContextRetrieval)

### Embedding Infrastructure (ML Model)

- [x] T012 Create embedding Web Worker in src/services/embedding/worker.ts with Transformers.js pipeline initialization
- [x] T013 Implement EmbeddingService in src/services/embedding/generator.ts (initialize, generateEmbedding, generateBatchEmbeddings)
- [x] T014 Implement model loading and management in src/services/embedding/models.ts (WebGPU/WASM device selection)
- [x] T015 Create similarity search utilities in src/services/memory/search.ts (cosineSimilarity function, findSimilar function)

### Tests for Foundational Layer

- [x] T016 [P] Unit test for embedding generation in tests/unit/embedding-generator.test.ts (verify 384-dim normalized vectors)
- [x] T017 [P] Unit test for cosine similarity in tests/unit/similarity-search.test.ts (verify similarity calculations)
- [x] T018 [P] Integration test for embedding encryption in tests/integration/encryption.test.ts (verify vectors encrypted at rest)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: ~~User Story 1 - AI Recalls Related Past Entries~~ [REMOVED]

> **DEPRECATION NOTICE**: User Story 1 (automatic context retrieval) has been removed from the implementation scope. Manual Memory Search (User Story 2) provides similar functionality with explicit user control.

**Original Goal**: Enable AI to automatically retrieve and reference relevant past journal entries during conversations

**Tasks Removed**:
- [REMOVED] T019 [P] [US1] Integration test for context retrieval
- [REMOVED] T020 [P] [US1] Unit test for memory indexer
- [REMOVED] T021 [P] [US1] Implement MemoryIndexer (partially kept - indexing still used for manual search)
- [REMOVED] T022 [US1] Implement context retrieval in src/services/memory/retrieval.ts
- [REMOVED] T023 [US1] Implement MemoryService.getRelevantContext
- ~~[REMOVED] T024 [US1] Implement MemoryService.indexMessage~~ (kept - used by manual search)
- [REMOVED] T025 [US1] Create useContextRetrieval hook
- [REMOVED] T026 [US1] Create MemoryContext component
- [REMOVED] T027 [US1] Integrate MemoryContext component
- ~~[REMOVED] T028 [US1] Add automatic embedding generation~~ (kept - embeddings still needed for search)
- [REMOVED] T029 [US1] Component test for MemoryContext

**Note**: Core infrastructure (embedding generation, indexing, similarity search) remains functional and is used by Manual Memory Search (User Story 2)

---

## Phase 4: User Story 2 - Manual Memory Search (Priority: P2)

**Goal**: Users can explicitly search their journal history using natural language queries

**Independent Test**: Implement search interface, enter natural language query (e.g., "times I felt proud"), verify system returns semantically related entries even without exact word matches

### Tests for User Story 2

- [x] T030 [P] [US2] Component test for MemorySearch in tests/component/MemorySearch.test.tsx (test search UI, result display, loading states)

### Implementation for User Story 2

- [x] T031 [P] [US2] Implement MemoryService.search in src/services/memory/search.ts (accepts MemorySearchQuery, returns ranked MemorySearchResults with scores and excerpts)
- [x] T032 [P] [US2] Implement MemoryService.getIndexStats in src/services/memory/search.ts (returns index statistics for debugging)
- [x] T033 [US2] Create useMemorySearch hook in src/hooks/useMemorySearch.ts (manages search state, loading, errors, results)
- [x] T034 [US2] Create SearchResults component in src/components/search/SearchResults.tsx (displays ranked results with date, excerpt, score using Card and Badge)
- [x] T035 [US2] Create MemorySearch component in src/components/search/MemorySearch.tsx (search dialog using Command and Dialog from shadcn/ui)
- [x] T036 [US2] Integrate MemorySearch into app navigation (add search trigger button/keyboard shortcut)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - auto context + manual search

---

## Phase 5: User Story 3 - Cross-Chat Context Awareness (Priority: P3)

**Goal**: AI identifies recurring themes and patterns across all journal chats

**Independent Test**: Create entries with recurring themes across multiple chats (e.g., "sleep problems" in 5 chats), verify AI recognizes patterns and offers insights

### Tests for User Story 3

- [x] T037 [P] [US3] Integration test for pattern recognition in tests/integration/pattern-analysis.test.ts (verify recurring theme detection)

### Implementation for User Story 3

- [x] T038 [P] [US3] Implement theme clustering in src/services/memory/analysis.ts (analyzes embeddings to identify recurring topics)
- [x] T039 [P] [US3] Implement pattern recognition in src/services/memory/patterns.ts (detects recurring themes across chats)
- [x] T040 [US3] Extend MemoryService with analyzeRecurringThemes method in src/services/memory/search.ts
- [x] T041 [US3] Extend useContextRetrieval hook to include pattern insights in src/hooks/useContextRetrieval.ts
- [x] T042 [US3] Update MemoryContext component to display pattern insights in src/components/chat/MemoryContext.tsx
- [x] T043 [US3] Add "Topics I write about" summary feature to MemorySearch component in src/components/search/MemorySearch.tsx

**Checkpoint**: All user stories should now be independently functional - auto context + manual search + pattern recognition

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Performance & Optimization

- [x] T044 [P] Add batch embedding for initial indexing of existing messages in src/services/memory/indexer.ts
- [x] T045 [P] Implement embedding queue persistence (survive page refresh) in src/services/memory/indexer.ts
- [ ] T046 Add loading indicators for model download in MemorySearch component

### Error Handling & Edge Cases

- [x] T047 [P] Handle empty search results gracefully in SearchResults component
- [x] T048 [P] Handle very long messages (>256 tokens) with chunking strategy in src/services/embedding/generator.ts
- [ ] T049 Add error boundary for embedding service failures in MemorySearch and MemoryContext components
- [x] T050 Implement cleanup for orphaned embeddings in src/services/memory/indexer.ts

### Developer Experience

- [x] T051 [P] Create useEmbeddingService hook for service initialization status in src/hooks/useEmbeddingService.ts
- [x] T052 [P] Create useMemoryIndex hook for index monitoring in src/hooks/useMemoryIndex.ts
- [x] T053 Add rebuild index functionality for model upgrades in src/services/memory/search.ts

### Documentation & Validation

- [x] T054 [P] Validate quickstart.md examples against implementation
- [x] T055 [P] Add JSDoc comments to all public service methods
- [x] T056 Run full test suite and achieve >90% coverage for embedding pipeline

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independently testable (only needs search functionality, not auto-context)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends US1 but independently testable (pattern detection can work standalone)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Services before components
- Hooks before components that use them
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Setup Phase**:
- T002-T006: All can run in parallel (different directories/files)

**Foundational Phase**:
- T009-T011: Contract interfaces (all parallel)
- T016-T018: Foundation tests (all parallel)

**User Story 1**:
- T019-T020: Tests (parallel - different files)
- T021-T022: Core services (parallel - different files)
- After services complete: T025-T026 (hook and component in parallel)

**User Story 2**:
- T031-T032: Service methods (parallel - same file, different methods)
- T034-T035: Components (parallel - different files)

**User Story 3**:
- T038-T039: Analysis services (parallel - different files)

**Polish Phase**:
- T044-T046: Optimization tasks (all parallel)
- T047-T050: Error handling (all parallel)
- T051-T053: Developer tools (all parallel)
- T054-T056: Documentation (all parallel)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Integration test for context retrieval in tests/integration/memory-pipeline.test.ts"
Task: "Unit test for memory indexer in tests/unit/indexer.test.ts"

# After tests pass, launch core services in parallel:
Task: "Implement MemoryIndexer in src/services/memory/indexer.ts"
Task: "Implement context retrieval in src/services/memory/retrieval.ts"

# After services complete, launch UI layer in parallel:
Task: "Create useContextRetrieval hook in src/hooks/useContextRetrieval.ts"
Task: "Create MemoryContext component in src/components/chat/MemoryContext.tsx"
```

---

## Parallel Example: User Story 2

```bash
# Launch service methods in parallel:
Task: "Implement MemoryService.search in src/services/memory/search.ts"
Task: "Implement MemoryService.getIndexStats in src/services/memory/search.ts"

# Launch UI components in parallel:
Task: "Create SearchResults component in src/components/search/SearchResults.tsx"
Task: "Create MemorySearch component in src/components/search/MemorySearch.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T018) - CRITICAL blocks all stories
3. Complete Phase 3: User Story 1 (T019-T029)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Create sample entries about "work stress"
   - Start new conversation mentioning "work stress"
   - Verify AI retrieves past entries automatically
5. Deploy/demo MVP with automatic context awareness

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - auto context!)
3. Add User Story 2 → Test independently → Deploy/Demo (+ manual search)
4. Add User Story 3 → Test independently → Deploy/Demo (+ pattern insights)
5. Add Polish phase → Final release
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T018)
2. Once Foundational is done:
   - Developer A: User Story 1 (T019-T029)
   - Developer B: User Story 2 (T030-T036)
   - Developer C: User Story 3 (T037-T043)
3. Stories complete and integrate independently
4. Team reconvenes for Polish phase (T044-T056)

---

## Task Count Summary

- **Setup**: 6 tasks
- **Foundational**: 12 tasks (BLOCKING)
- **User Story 1 (P1)**: 11 tasks
- **User Story 2 (P2)**: 7 tasks
- **User Story 3 (P3)**: 7 tasks
- **Polish**: 13 tasks
- **TOTAL**: 56 tasks

### Tasks per Priority

- **P1 (MVP)**: 18 tasks (Setup + Foundational + US1)
- **P2 (+ Search)**: 7 tasks
- **P3 (+ Patterns)**: 7 tasks
- **Polish**: 13 tasks

### Parallel Opportunities

- **Setup**: 5 parallel tasks (T002-T006)
- **Foundational**: 5 parallel groups (contracts, tests)
- **User Story 1**: 3 parallel groups
- **User Story 2**: 2 parallel groups
- **User Story 3**: 2 parallel groups
- **Polish**: 4 parallel groups (16 total parallel tasks)

**Estimated effort with parallelization**: ~30% reduction in serial execution time

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story independently completable and testable
- All tests written using TDD approach (test fails first)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance: Privacy-first (local embeddings), TDD (tests before code), Simplicity (defer ANN), UI (shadcn/ui + Tailwind)
