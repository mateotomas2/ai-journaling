# Tasks: User Settings Management

**Input**: Design documents from `/specs/002-settings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/services.md, quickstart.md

**Tests**: Tests are included per project constitution (TDD required)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app structure**: `src/` and `tests/` at repository root
- React components: `src/components/`
- Services: `src/services/`
- Hooks: `src/hooks/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for settings feature

- [X] T001 Add Settings route to router in src/App.tsx
- [X] T002 [P] Add Settings navigation link to Layout in src/components/common/Layout.tsx
- [X] T003 [P] Create settings component directory structure at src/components/settings/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Extend Settings schema with systemPrompt field in src/db/schemas/settings.schema.ts
- [X] T005 [P] Extend Settings interface with systemPrompt field in src/types/entities.ts
- [X] T006 [P] Create validation service at src/services/settings/validation.ts
- [X] T007 [P] Create toast notification hook at src/hooks/useToast.ts
- [X] T008 Create settings service at src/services/settings/settings.service.ts
- [X] T009 [P] Create data management service at src/services/settings/data-management.service.ts
- [X] T010 Extend useSettings hook with systemPrompt operations in src/hooks/useSettings.ts
- [X] T011 Create main SettingsPage container component at src/pages/SettingsPage.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Modify OpenRouter API Key (Priority: P1) 🎯 MVP

**Goal**: Enable users to view and update their OpenRouter API key with validation and encrypted storage

**Independent Test**: Navigate to settings, view masked API key, enter new valid key, save, verify AI chat works with new credentials. Test validation by entering invalid key format.

### Tests for User Story 1 (TDD Required)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US1] Write unit tests for API key validation in tests/unit/validation.test.ts
- [X] T013 [P] [US1] Write unit tests for updateApiKey service in tests/unit/settings.service.test.ts
- [X] T014 [P] [US1] Write integration tests for ApiKeySection component in tests/integration/SettingsPage.test.tsx

### Implementation for User Story 1

- [X] T015 [US1] Implement validateApiKey function in src/services/settings/validation.ts
- [X] T016 [US1] Implement updateApiKey function in src/services/settings/settings.service.ts
- [X] T017 [US1] Create ApiKeySection component in src/components/settings/ApiKeySection.tsx
- [X] T018 [US1] Add ApiKeySection component styles in src/components/settings/ApiKeySection.css
- [X] T019 [US1] Integrate ApiKeySection into SettingsPage in src/pages/SettingsPage.tsx
- [X] T020 [US1] Add toast notifications for success/error states in ApiKeySection component
- [X] T021 [US1] Test API key masking display (show last 4 chars only)
- [X] T022 [US1] Test validation error handling for invalid key formats
- [X] T023 [US1] Test encrypted storage by inspecting IndexedDB in DevTools
- [X] T024 [US1] Test auto-persist behavior for settings changes (FR-016: verify API key changes save immediately without explicit save button)

**Checkpoint**: At this point, User Story 1 should be fully functional - users can view and update API keys

---

## Phase 4: User Story 2 - Customize Initial Chat Prompt (Priority: P2)

**Goal**: Enable users to customize the AI system prompt with preview, save, and reset to default functionality

**Independent Test**: Navigate to settings, view current system prompt, modify it, save, start a new day's chat, verify AI responds according to custom instructions. Test reset to default.

### Tests for User Story 2 (TDD Required)

- [X] T025 [P] [US2] Write unit tests for system prompt validation in tests/unit/validation.test.ts
- [X] T026 [P] [US2] Write unit tests for getSystemPrompt and updateSystemPrompt in tests/unit/settings.service.test.ts
- [X] T027 [P] [US2] Write unit tests for resetSystemPrompt in tests/unit/settings.service.test.ts
- [X] T028 [P] [US2] Write integration tests for PromptCustomization component in tests/integration/SettingsPage.test.tsx

### Implementation for User Story 2

- [X] T029 [US2] Implement validateSystemPrompt function in src/services/settings/validation.ts
- [X] T030 [US2] Implement getSystemPrompt function in src/services/settings/settings.service.ts
- [X] T031 [US2] Implement updateSystemPrompt function in src/services/settings/settings.service.ts
- [X] T032 [US2] Implement resetSystemPrompt function in src/services/settings/settings.service.ts
- [X] T033 [US2] Update useSettings hook to expose systemPrompt operations in src/hooks/useSettings.ts
- [X] T034 [US2] Create PromptCustomization component in src/components/settings/PromptCustomization.tsx
- [X] T035 [US2] Add PromptCustomization component styles in src/components/settings/PromptCustomization.css
- [X] T036 [US2] Integrate PromptCustomization into SettingsPage in src/pages/SettingsPage.tsx
- [X] T037 [US2] Add toast notifications for save/reset operations in PromptCustomization component
- [X] T038 [US2] Update AI chat service to use custom system prompt in src/services/ai/chat.ts
- [X] T039 [US2] Test character limit validation (5000 chars max)
- [X] T040 [US2] Test reset to default functionality
- [X] T041 [US2] Test custom prompt application in new chat session

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can manage API keys and customize prompts

---

## Phase 5: User Story 3 - Export and Import Journal Data (Priority: P3)

**Goal**: Enable users to export all journal data to JSON and import from backup files with validation and duplicate handling

**Independent Test**: Create journal entries, export to JSON, verify file contents, clear database (via browser DevTools), import file, verify all data restored. Test duplicate handling and error cases.

### Tests for User Story 3 (TDD Required)

- [X] T042 [P] [US3] Write unit tests for exportAllData in tests/unit/data-management.test.ts
- [X] T043 [P] [US3] Write unit tests for importData in tests/unit/data-management.test.ts
- [X] T044 [P] [US3] Write integration tests for DataManagement component in tests/integration/SettingsPage.test.tsx

### Implementation for User Story 3

- [X] T045 [US3] Implement exportAllData function in src/services/settings/data-management.service.ts (reuse export.ts)
- [X] T046 [US3] Implement importData function in src/services/settings/data-management.service.ts (reuse import.ts)
- [X] T047 [US3] Create DataManagement component in src/components/settings/DataManagement.tsx
- [X] T048 [US3] Add DataManagement component styles in src/components/settings/DataManagement.css
- [X] T049 [US3] Integrate DataManagement into SettingsPage in src/pages/SettingsPage.tsx
- [X] T050 [US3] Add file picker for import in DataManagement component
- [X] T051 [US3] Add export download trigger in DataManagement component
- [X] T052 [US3] Display import statistics (imported count, skipped duplicates) with toast notifications
- [X] T053 [US3] Add error handling for invalid file formats with clear error messages
- [X] T054 [US3] Test export with 1 year of sample data (performance check)
- [X] T055 [US3] Test import validation rejects incompatible schema versions
- [X] T056 [US3] Test duplicate ID detection and skip behavior
- [X] T057 [US3] Test round-trip: export → clear → import → verify data integrity

**Checkpoint**: All user stories should now be independently functional - users can manage settings and backup/restore data

---

## Phase 6: User Story 4 - Clear All Data (Nuke Session) (Priority: P4)

**Goal**: Enable users to permanently delete all journal data with multi-step confirmation to prevent accidental deletion

**Independent Test**: Create journal entries, click Clear All Data, see warning dialog, type confirmation phrase, confirm, verify database cleared and redirected to setup page. Test cancel behavior.

### Tests for User Story 4 (TDD Required)

- [ ] T058 [P] [US4] Write unit tests for clearAllData in tests/unit/data-management.test.ts
- [ ] T059 [P] [US4] Write integration tests for ClearDataConfirmation component in tests/integration/SettingsPage.test.tsx

### Implementation for User Story 4

- [X] T060 [US4] Implement clearAllData function in src/services/settings/data-management.service.ts
- [X] T061 [US4] Create ClearDataConfirmation modal component in src/components/settings/ClearDataConfirmation.tsx
- [X] T062 [US4] Add ClearDataConfirmation component styles in src/components/settings/ClearDataConfirmation.css
- [X] T063 [US4] Add Clear All Data button to DataManagement component in src/components/settings/DataManagement.tsx
- [X] T064 [US4] Integrate ClearDataConfirmation modal into DataManagement component
- [X] T065 [US4] Implement typed confirmation phrase validation in ClearDataConfirmation component
- [X] T066 [US4] Add redirect to setup page after successful data clearing
- [X] T067 [US4] Add prominent warning message in confirmation dialog
- [ ] T068 [US4] Test cancel behavior (no data deleted)
- [ ] T069 [US4] Test successful clear redirects to setup page
- [ ] T070 [US4] Test confirmation phrase must match exactly (case-sensitive)
- [ ] T071 [US4] Test database and localStorage fully cleared via DevTools inspection

**Checkpoint**: All user stories complete - full settings functionality available

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final quality assurance

- [X] T072 [P] Add responsive styles for mobile in src/components/settings/*.css
- [X] T073 [P] Add keyboard navigation support (Tab, Enter) to all settings forms
- [X] T074 [P] Add ARIA labels and accessibility attributes to settings components
- [X] T075 [P] Add loading states for all async operations in settings components
- [X] T076 Update SettingsPage styles in src/pages/SettingsPage.css
- [ ] T077 [P] Test offline functionality for all settings operations
- [ ] T078 [P] Test encryption of API key and system prompt in IndexedDB
- [ ] T079 Code review and refactoring for DRY principles across settings services
- [ ] T080 [P] Run full test suite and achieve >90% coverage for critical paths
- [ ] T081 Run manual testing checklist from quickstart.md
- [ ] T082 [P] Update CLAUDE.md with settings feature documentation
- [ ] T083 Performance testing: export/import with 5 years of sample data

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Shares DataManagement component with US3 but can be implemented independently

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Validation functions before services
- Services before components
- Components before integration into SettingsPage
- Core implementation before error handling and polish
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003)
- All Foundational tasks marked [P] can run in parallel (T005, T006, T007, T009)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Service implementations within a story can run in parallel if independent
- Different user stories can be worked on in parallel by different team members
- Polish tasks marked [P] can run in parallel (T072-T075, T077-T078, T080, T082)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (TDD - write these first):
Task: "Write unit tests for API key validation in tests/unit/validation.test.ts"
Task: "Write unit tests for updateApiKey service in tests/unit/settings.service.test.ts"
Task: "Write integration tests for ApiKeySection component in tests/integration/SettingsPage.test.tsx"

# After tests fail, implement in parallel:
Task: "Implement validateApiKey function in src/services/settings/validation.ts"
Task: "Implement updateApiKey function in src/services/settings/settings.service.ts"

# Then create component:
Task: "Create ApiKeySection component in src/components/settings/ApiKeySection.tsx"
Task: "Add ApiKeySection component styles in src/components/settings/ApiKeySection.css"
```

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together (TDD - write these first):
Task: "Write unit tests for system prompt validation in tests/unit/validation.test.ts"
Task: "Write unit tests for getSystemPrompt and updateSystemPrompt in tests/unit/settings.service.test.ts"
Task: "Write unit tests for resetSystemPrompt in tests/unit/settings.service.test.ts"
Task: "Write integration tests for PromptCustomization component in tests/integration/SettingsPage.test.tsx"

# After tests fail, implement validation and services in parallel:
Task: "Implement validateSystemPrompt function in src/services/settings/validation.ts"
Task: "Implement getSystemPrompt function in src/services/settings/settings.service.ts"
Task: "Implement updateSystemPrompt function in src/services/settings/settings.service.ts"
Task: "Implement resetSystemPrompt function in src/services/settings/settings.service.ts"
```

---

## Parallel Example: Foundational Phase

```bash
# After schema extended (T004), run these in parallel:
Task: "Extend Settings interface with systemPrompt field in src/types/entities.ts"
Task: "Create validation service at src/services/settings/validation.ts"
Task: "Create toast notification hook at src/hooks/useToast.ts"
Task: "Create data management service at src/services/settings/data-management.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T011) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T012-T023)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo API key management feature if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: API key management)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP + prompt customization)
4. Add User Story 3 → Test independently → Deploy/Demo (MVP + backup/restore)
5. Add User Story 4 → Test independently → Deploy/Demo (Full settings suite)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T011)
2. Once Foundational is done:
   - Developer A: User Story 1 (T012-T023) - API Key Management
   - Developer B: User Story 2 (T025-T041) - Prompt Customization
   - Developer C: User Story 3 (T042-T057) - Export/Import
   - Developer D: User Story 4 (T058-T071) - Clear All Data
3. Stories complete and integrate independently into SettingsPage
4. Team collaborates on Phase 7: Polish (T072-T083)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD REQUIRED: Write tests first, verify they fail, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Reuse existing services: export.ts, import.ts from 001-daily-journal-chat
- All settings operations are client-side only (no backend changes)
- Test encryption by inspecting IndexedDB in browser DevTools
- Test offline functionality for all settings operations
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Task Count Summary

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 8 tasks (BLOCKING)
- **Phase 3 (User Story 1 - P1)**: 13 tasks (MVP) - includes T024 auto-persist test
- **Phase 4 (User Story 2 - P2)**: 17 tasks
- **Phase 5 (User Story 3 - P3)**: 16 tasks
- **Phase 6 (User Story 4 - P4)**: 14 tasks
- **Phase 7 (Polish)**: 12 tasks
- **TOTAL**: 83 tasks

---

## Suggested MVP Scope

**Minimal Viable Product (US1 only)**: 24 tasks (Setup + Foundational + US1)
- Users can view and update OpenRouter API key
- Encrypted storage and validation included
- Toast notifications for feedback
- Auto-persist behavior tested (FR-016)
- Estimated implementation: 1-2 days with TDD

**Enhanced MVP (US1 + US2)**: 41 tasks
- API key management + prompt customization
- Full personalization capabilities
- Estimated implementation: 2-3 days with TDD

**Full Feature (All User Stories)**: 83 tasks
- Complete settings suite with backup/restore and data clearing
- Estimated implementation: 4-5 days with TDD
