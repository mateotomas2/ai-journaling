# Tasks: AI Model Selection for Summarizer

**Input**: Design documents from `/specs/001-ai-model-selection/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED per project constitution (TDD methodology strictly enforced). All tests must be written BEFORE implementation code.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Web application structure:
- Frontend: `src/` (React application)
- Backend: `server/` (Express API)
- Tests: `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification of existing structure

- [X] T001 Verify TypeScript configuration (strict mode enabled) in tsconfig.json
- [X] T002 Verify test framework (Vitest) configuration in package.json
- [X] T003 [P] Verify RxDB and Zod dependencies are installed
- [X] T004 [P] Review existing Settings schema in src/services/db/schemas.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Data Layer Foundation

- [X] T005 Write failing test for Settings schema with summarizerModel field in tests/unit/settings.schema.test.ts
- [X] T006 Extend Settings schema to accept optional summarizerModel field in src/db/schemas/settings.schema.ts
- [X] T007 Verify Settings schema test passes

### Type Definitions

- [X] T008 [P] Define AIModel interface in src/types/entities.ts
- [X] T009 [P] Define FALLBACK_MODELS constant with 5 curated models in src/services/ai/models.service.ts

### Settings Service Foundation

- [X] T010 Write failing test for getSummarizerModel() returning default in tests/unit/settings.service.test.ts
- [X] T011 Write failing test for updateSummarizerModel() persisting value in tests/unit/settings.service.test.ts
- [X] T012 Implement getSummarizerModel() in src/services/settings/settings.service.ts
- [X] T013 Implement updateSummarizerModel() in src/services/settings/settings.service.ts
- [X] T014 Verify all settings service tests pass

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configure Preferred AI Model (Priority: P1) 🎯 MVP

**Goal**: Users can select and persist their preferred AI model for summarization in the settings UI

**Independent Test**: Navigate to settings, select a model from dropdown, save, refresh page, verify selection persists

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T015 [P] [US1] Write failing component test for ModelSelector rendering dropdown in tests/component/ModelSelector.test.tsx
- [ ] T016 [P] [US1] Write failing component test for ModelSelector onChange handler in tests/component/ModelSelector.test.tsx
- [ ] T017 [P] [US1] Write failing integration test for Settings page model selection in tests/integration/settings-page.test.tsx
- [ ] T018 [P] [US1] Write failing integration test for model persistence across sessions in tests/integration/settings-page.test.tsx

### Implementation for User Story 1

- [ ] T019 [US1] Create ModelSelector component skeleton in src/components/settings/ModelSelector.tsx
- [ ] T020 [US1] Implement ModelSelector dropdown with hardcoded models (use FALLBACK_MODELS)
- [ ] T021 [US1] Add value and onChange props to ModelSelector component
- [ ] T022 [US1] Integrate ModelSelector into Settings page in src/pages/Settings.tsx
- [ ] T023 [US1] Load current model selection on Settings page mount using getSummarizerModel()
- [ ] T024 [US1] Handle model selection change and persist using updateSummarizerModel()
- [ ] T025 [US1] Add ARIA labels and keyboard navigation to ModelSelector for accessibility
- [ ] T026 [US1] Verify all User Story 1 tests pass

**Checkpoint**: At this point, User Story 1 should be fully functional - users can select and persist model preference with hardcoded model list

---

## Phase 4: User Story 2 - Generate Summaries with Selected Model (Priority: P2)

**Goal**: Daily summaries use the user's selected AI model instead of hardcoded default

**Independent Test**: Select a specific model in settings, generate a summary, verify correct model is used in OpenRouter API call

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T027 [P] [US2] Write failing test for summary.service with model parameter in tests/unit/summary.service.test.ts
- [ ] T028 [P] [US2] Write failing backend test for /api/summary with model field in tests/integration/api.test.ts
- [ ] T029 [P] [US2] Write failing backend test for /api/summary using default model when not provided in tests/integration/api.test.ts
- [ ] T030 [P] [US2] Write failing integration test for E2E summary generation with selected model in tests/integration/model-selection.test.ts

### Implementation for User Story 2

- [ ] T031 [P] [US2] Update generateSummary() signature to accept optional summarizerModel parameter in src/services/ai/summary.service.ts
- [ ] T032 [P] [US2] Modify generateSummary() to include model in request body if provided in src/services/ai/summary.service.ts
- [ ] T033 [P] [US2] Update backend /api/summary endpoint to extract model from request body in server/routes/ai.ts
- [ ] T034 [US2] Modify backend to use model || DEFAULT_MODEL in OpenRouter API call in server/routes/ai.ts
- [ ] T035 [US2] Update summary generation call sites to fetch and pass summarizerModel from settings
- [ ] T036 [US2] Verify all User Story 2 tests pass

**Checkpoint**: At this point, User Story 2 should be fully functional - summaries use the selected model

---

## Phase 5: User Story 3 - Browse Available Models (Priority: P3)

**Goal**: Users can browse 339+ models dynamically fetched from OpenRouter API instead of hardcoded list

**Independent Test**: Open settings, verify models are fetched from OpenRouter API, scroll through comprehensive list

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T037 [P] [US3] Write failing test for fetchModels() calling OpenRouter API in tests/unit/models.service.test.ts
- [ ] T038 [P] [US3] Write failing test for fetchModels() returning fallback on API failure in tests/unit/models.service.test.ts
- [ ] T039 [P] [US3] Write failing test for extractProvider() helper function in tests/unit/models.service.test.ts
- [ ] T040 [P] [US3] Write failing component test for ModelSelector fetching models on mount in tests/component/ModelSelector.test.tsx
- [ ] T041 [P] [US3] Write failing component test for ModelSelector displaying fallback on API error in tests/component/ModelSelector.test.tsx

### Implementation for User Story 3

- [ ] T042 [P] [US3] Implement fetchModels() to call OpenRouter /api/v1/models in src/services/ai/models.service.ts
- [ ] T043 [P] [US3] Implement error handling and fallback to FALLBACK_MODELS in fetchModels()
- [ ] T044 [P] [US3] Implement extractProvider() to parse provider from model name/ID in src/services/ai/models.service.ts
- [ ] T045 [P] [US3] Implement transformToAIModel() to convert API response to AIModel type in src/services/ai/models.service.ts
- [ ] T046 [US3] Update ModelSelector to fetch models from API on mount in src/components/settings/ModelSelector.tsx
- [ ] T047 [US3] Add loading state to ModelSelector while fetching models
- [ ] T048 [US3] Add error state to ModelSelector with user-friendly message
- [ ] T049 [US3] Replace hardcoded FALLBACK_MODELS with API-fetched models in dropdown
- [ ] T050 [US3] Verify all User Story 3 tests pass

**Checkpoint**: At this point, User Story 3 should be fully functional - users can browse full OpenRouter catalog

---

## Phase 6: User Story 4 - Understand Model Differences (Priority: P4)

**Goal**: Users see pricing and provider information to make informed model selections

**Independent Test**: Open model dropdown, verify each model shows provider name and pricing information

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T051 [P] [US4] Write failing component test for ModelSelector displaying provider names in tests/component/ModelSelector.test.tsx
- [ ] T052 [P] [US4] Write failing component test for ModelSelector displaying pricing information in tests/component/ModelSelector.test.tsx
- [ ] T053 [P] [US4] Write failing test for search/filter functionality in tests/component/ModelSelector.test.tsx

### Implementation for User Story 4

- [ ] T054 [P] [US4] Add provider name display to each model option in ModelSelector in src/components/settings/ModelSelector.tsx
- [ ] T055 [P] [US4] Add pricing display (cost per prompt token) to each model option in ModelSelector
- [ ] T056 [US4] Implement search input field in ModelSelector component
- [ ] T057 [US4] Implement client-side filter logic for model list based on search term
- [ ] T058 [US4] Add visual indicators for budget/mid-range/premium models based on pricing
- [ ] T059 [US4] Verify all User Story 4 tests pass

**Checkpoint**: At this point, User Story 4 should be fully functional - users can compare models by price and provider

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final quality improvements, edge cases, and integration validation

### Edge Case Handling

- [ ] T060 [P] Write test for deprecated model warning in tests/integration/model-selection.test.ts
- [ ] T061 [P] Write test for concurrent model selection changes in tests/integration/model-selection.test.ts
- [ ] T062 [P] Implement warning when saved model is no longer in API response
- [ ] T063 [P] Add debouncing to search input to improve performance
- [ ] T064 [P] Add keyboard shortcuts for model selector (arrow keys, enter to select)

### Error Handling & Validation

- [ ] T065 [P] Add user-friendly error messages for all API failures
- [ ] T066 [P] Validate model selection before save (FR-011)
- [ ] T067 [P] Add loading indicators with appropriate ARIA labels
- [ ] T068 [P] Test graceful degradation when OpenRouter API is slow (>5s)

### Documentation & Code Quality

- [ ] T069 [P] Add JSDoc comments to all public functions
- [ ] T070 [P] Run TypeScript strict mode check (no `any` types)
- [ ] T071 [P] Run test coverage report (target >90% for new code)
- [ ] T072 [P] Verify all functional requirements (FR-001 through FR-012) are met
- [ ] T073 [P] Verify all success criteria (SC-001 through SC-008) are met

### Final Integration Testing

- [ ] T074 E2E test: Complete user workflow (select model → generate summary → verify)
- [ ] T075 E2E test: Offline mode with fallback models
- [ ] T076 E2E test: Settings persistence across browser sessions
- [ ] T077 Manual testing: Accessibility with screen reader
- [ ] T078 Manual testing: Keyboard-only navigation

**Final Checkpoint**: Feature is production-ready

---

## Dependencies & Execution Strategy

### Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundation) ← MUST complete before user stories
    ↓
    ├─→ Phase 3 (US1: Configure Model) ← MVP
    │       ↓
    ├─→ Phase 4 (US2: Use Selected Model) ← Depends on US1
    │       ↓
    ├─→ Phase 5 (US3: Browse Models) ← Can start after US1
    │       ↓
    └─→ Phase 6 (US4: Understand Differences) ← Depends on US3
            ↓
        Phase 7 (Polish) ← All stories complete
```

### Story Independence

- **US1 (P1)**: Independent - can be implemented and tested standalone with hardcoded models
- **US2 (P2)**: Depends on US1 - needs model selection to be working
- **US3 (P3)**: Depends on US1 - enhances model selection with API fetch
- **US4 (P4)**: Depends on US3 - adds details to API-fetched models

### Parallel Execution Opportunities

**Within Phase 2 (Foundation)**:
- T008-T009 can run parallel to T005-T007 (types vs schema)
- T010-T011 tests can be written in parallel

**Within User Story 1 (Phase 3)**:
- T015-T018 (all test files) can be written in parallel
- T025 (accessibility) can be done in parallel with T026 (test verification)

**Within User Story 2 (Phase 4)**:
- T027-T030 (all test files) can be written in parallel
- T031-T033 (frontend, backend changes) can be developed in parallel

**Within User Story 3 (Phase 5)**:
- T037-T041 (all test files) can be written in parallel
- T042-T044 (models service functions) can be implemented in parallel
- T046-T049 (component updates) are sequential

**Within User Story 4 (Phase 6)**:
- T051-T053 (all test files) can be written in parallel
- T054-T055 (display changes) can be done in parallel

**Within Phase 7 (Polish)**:
- T060-T064 (edge cases) can all run in parallel
- T065-T068 (error handling) can all run in parallel
- T069-T073 (documentation/quality) can all run in parallel

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)

**Recommended MVP**: User Story 1 only (Phase 1-3)
- Enables core functionality: users can select and save model preference
- Uses hardcoded fallback models (simple, reliable)
- Delivers immediate value
- ~30 tasks, estimated 2-3 days with TDD

**Extended MVP**: User Stories 1-2 (Phase 1-4)
- Adds actual usage of selected model in summaries
- Complete feature with basic model list
- ~36 tasks, estimated 3-4 days with TDD

**Full Feature**: All User Stories (Phase 1-7)
- Dynamic API fetching
- Rich model information
- All edge cases handled
- ~78 tasks, estimated 5-7 days with TDD

### Incremental Delivery

1. **Week 1**: Deploy MVP (US1) - users can configure preference
2. **Week 2**: Deploy US2 - summaries use selected model
3. **Week 3**: Deploy US3 - dynamic model list from API
4. **Week 4**: Deploy US4 + Polish - complete feature with all enhancements

---

## Task Summary

**Total Tasks**: 78
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundation): 10 tasks (BLOCKING)
- Phase 3 (US1 - MVP): 12 tasks
- Phase 4 (US2): 10 tasks
- Phase 5 (US3): 14 tasks
- Phase 6 (US4): 6 tasks
- Phase 7 (Polish): 22 tasks

**Tasks by Type**:
- Tests: 35 tasks (45%)
- Implementation: 38 tasks (49%)
- Validation/Polish: 5 tasks (6%)

**Parallel Opportunities**: ~40 tasks can run in parallel (51%)

**Format Validation**: ✅ All tasks follow checklist format with checkbox, ID, optional [P] marker, [Story] label, and file path

---

## Verification Checklist

Before marking feature complete:

- [ ] All 78 tasks completed
- [ ] All tests pass (unit, integration, component, E2E)
- [ ] Test coverage >90% for new code
- [ ] TypeScript strict mode passes (no `any` types)
- [ ] All functional requirements (FR-001 through FR-012) verified
- [ ] All success criteria (SC-001 through SC-008) met
- [ ] Constitution compliance verified (Privacy, TDD, Simplicity, Quality)
- [ ] Accessibility tested (keyboard navigation, screen reader)
- [ ] Manual testing complete in browser
- [ ] Documentation updated (if user-facing changes)
- [ ] Code review completed
- [ ] Ready for production deployment
