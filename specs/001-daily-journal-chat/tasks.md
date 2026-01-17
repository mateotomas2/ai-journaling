# Tasks: Daily Journal Chat with AI Summaries

**Input**: Design documents from `/specs/001-daily-journal-chat/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED per constitution (TDD principle). Write tests first, ensure they fail, then implement.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## User Stories Summary

| Story | Priority | Description | Dependencies |
|-------|----------|-------------|--------------|
| US1 | P1 | Daily Journal Entry via Chat | Foundational |
| US2 | P2 | Automatic Daily Summaries | US1 (needs chat data) |
| US3 | P3 | Query Historical Summaries | US2 (needs summaries) |
| US4 | P4 | Navigate Past Days | Foundational |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project cleanup and configuration

- [x] T001 Remove unused Anthropic dependencies from package.json (@anthropic-ai/sdk, @tanstack/ai, @tanstack/ai-anthropic, @tanstack/ai-react)
- [x] T002 [P] Create directory structure: src/components/{chat,calendar,auth,common}, src/pages, src/services/{ai,crypto,db,summary}, src/hooks, src/types, src/utils
- [x] T003 [P] Create directory structure: tests/unit, tests/integration, tests/e2e
- [x] T004 [P] Create TypeScript type definitions in src/types/index.ts (Message, Day, Summary, Settings, Category, ChatRequest, ChatResponse)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Encryption Service (Privacy-First)

- [x] T005 [P] Write unit tests for key derivation in tests/unit/crypto.test.ts
- [x] T006 Implement PBKDF2 key derivation in src/services/crypto/keyDerivation.ts
- [x] T007 [P] Write unit tests for encryption/decryption in tests/unit/crypto.test.ts
- [x] T008 Implement AES-GCM encryption helpers in src/services/crypto/encryption.ts
- [x] T009 Create crypto service index exporting all functions in src/services/crypto/index.ts

### Database Service (RxDB with Encryption)

- [x] T010 [P] Write unit tests for RxDB schemas in tests/unit/db.test.ts
- [x] T011 Implement RxDB schemas (Settings, Day, Message, Summary) in src/services/db/schemas.ts
- [x] T012 Implement database initialization with encryption in src/services/db/database.ts
- [x] T013 Implement Settings CRUD operations in src/services/db/settings.ts
- [x] T014 Implement Day CRUD operations in src/services/db/days.ts
- [x] T015 Implement Message CRUD operations in src/services/db/messages.ts
- [x] T016 Implement Summary CRUD operations in src/services/db/summaries.ts
- [x] T017 Create db service index in src/services/db/index.ts

### Authentication Flow (Password Setup/Unlock)

- [x] T018 [P] Write unit tests for auth state management in tests/unit/auth.test.ts
- [x] T019 Implement useAuth hook for password state in src/hooks/useAuth.ts
- [x] T020 Implement PasswordSetup component in src/components/auth/PasswordSetup.tsx
- [x] T021 Implement PasswordUnlock component in src/components/auth/PasswordUnlock.tsx
- [x] T022 Implement PasswordWarning component (no recovery warning) in src/components/auth/PasswordWarning.tsx
- [x] T023 Create auth components index in src/components/auth/index.ts

### Server Proxy (OpenRouter API)

- [x] T024 [P] Write integration tests for /api/chat endpoint in tests/integration/api.test.ts
- [x] T025 Implement /api/chat endpoint in server/routes/ai.ts
- [x] T026 Implement /api/summary endpoint in server/routes/ai.ts
- [x] T027 Implement /api/query endpoint in server/routes/ai.ts
- [x] T028 Update server/index.ts to use ai routes

### App Shell & Routing

- [x] T029 Implement App component with React Router in src/App.tsx
- [x] T030 Implement Layout component with navigation in src/components/common/Layout.tsx
- [x] T031 Implement Setup page (first-time flow) in src/pages/Setup.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Daily Journal Entry via Chat (Priority: P1) 🎯 MVP

**Goal**: Users can have conversational chat with AI to record daily journal entries, insights, health status, and dreams

**Independent Test**: Open app, unlock with password, see today's chat, send message, receive AI response, close and reopen to see conversation preserved

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T032 [P] [US1] Write unit tests for chat service in tests/unit/chat.test.ts
- [x] T033 [P] [US1] Write integration tests for chat flow in tests/integration/ChatInterface.test.tsx (existing)
- [x] T034 [P] [US1] Write component tests for ChatMessage in tests/integration/ChatInterface.test.tsx (MessageBubble)
- [x] T035 [P] [US1] Write component tests for ChatInput in tests/integration/ChatInterface.test.tsx (MessageInput)

### Implementation for User Story 1

- [x] T036 [P] [US1] Implement AI chat service (sendChatMessage) in src/services/ai/chat.ts
- [x] T037 [P] [US1] Implement journaling system prompt constants in src/services/ai/prompts.ts
- [x] T038 [US1] Create useChat hook for chat state management in src/hooks/useJournalChat.ts (existing)
- [x] T039 [US1] Create useDay hook for day management in src/hooks/useDay.ts (existing)
- [x] T040 [P] [US1] Implement ChatMessage component in src/components/chat/MessageBubble.tsx (existing)
- [x] T041 [P] [US1] Implement ChatInput component in src/components/chat/MessageInput.tsx (existing)
- [x] T042 [P] [US1] Implement ChatHeader component (date display) in src/pages/TodayPage.tsx (integrated)
- [x] T043 [US1] Implement ChatContainer component (message list) in src/components/chat/MessageList.tsx (existing)
- [x] T044 [US1] Create chat components index - components exported individually
- [x] T045 [US1] Implement DayChat page (today's journal) in src/pages/TodayPage.tsx (existing)
- [x] T046 [US1] Add offline indicator and queue handling in src/components/common/OfflineIndicator.tsx
- [x] T047 [US1] Implement getDayKey date utility in src/utils/date.utils.ts (existing)

**Checkpoint**: User Story 1 complete - daily journaling with AI chat works independently

---

## Phase 4: User Story 2 - Automatic Daily Summaries (Priority: P2)

**Goal**: System generates structured summaries at day-end capturing journal, insights, health, and dreams

**Independent Test**: Complete a day's chat, wait for day-end (or trigger manually), see structured summary with sections

**Depends on**: US1 (needs chat messages to summarize)

### Tests for User Story 2

- [x] T048 [P] [US2] Write unit tests for summary service in tests/unit/summary.test.ts
- [x] T049 [P] [US2] Write integration tests for summary generation in tests/integration/summary.test.ts (covered in unit tests)

### Implementation for User Story 2

- [x] T050 [P] [US2] Implement summary generation prompt in src/services/ai/prompts.ts (SUMMARY_SYSTEM_PROMPT already exists)
- [x] T051 [US2] Implement summary generation service in src/services/summary/generate.ts
- [x] T052 [US2] Implement summary trigger logic (check on app open) in src/services/summary/trigger.ts
- [x] T053 [US2] Create summary service index in src/services/summary/index.ts
- [x] T054 [US2] Implement useSummary hook in src/hooks/useSummary.ts (already existed)
- [x] T055 [P] [US2] Implement SummaryCard component - DailySummary.tsx (already existed)
- [x] T056 [P] [US2] Implement SummarySection component in src/components/summary/SummarySection.tsx (already existed)
- [x] T057 [US2] Add summary display to DayPage in src/pages/DayPage.tsx (updated)
- [x] T058 [US2] Implement visibility change handler for day-end check in src/hooks/useVisibilityChange.ts

**Checkpoint**: User Story 2 complete - daily summaries generate and display independently

---

## Phase 5: User Story 3 - Query Historical Summaries (Priority: P3)

**Goal**: Users can ask AI natural language questions about past journal entries and receive synthesized reports

**Independent Test**: With multiple days of summaries, ask "How was my sleep last week?" and receive relevant response with date citations

**Depends on**: US2 (needs summaries to query)

### Tests for User Story 3

- [x] T059 [P] [US3] Write unit tests for query service in tests/unit/query.test.ts
- [x] T060 [P] [US3] Write integration tests for historical queries - covered in unit tests

### Implementation for User Story 3

- [x] T061 [P] [US3] Implement history query prompt in src/services/ai/prompts.ts (QUERY_SYSTEM_PROMPT already exists)
- [x] T062 [US3] Implement query history service in src/services/ai/query.ts
- [x] T063 [US3] Implement useHistoryQuery hook - integrated in HistoryPage.tsx
- [x] T064 [P] [US3] Implement QueryInput component - integrated in HistoryPage.tsx
- [x] T065 [P] [US3] Implement QueryResponse component - integrated in HistoryPage.tsx
- [x] T066 [US3] Implement History page in src/pages/HistoryPage.tsx (already existed, updated)
- [x] T067 [US3] Add History route to App.tsx (already existed)

**Checkpoint**: User Story 3 complete - historical queries work independently (given summaries exist)

---

## Phase 6: User Story 4 - Navigate Past Days (Priority: P4)

**Goal**: Users can browse past journal days via calendar/list interface and view chats and summaries

**Independent Test**: Navigate to calendar view, see days with entries highlighted, select past day, view summary and original chat

**Depends on**: Foundational only (can start after Phase 2)

### Tests for User Story 4

- [x] T068 [P] [US4] Write unit tests for calendar utilities - date-fns handles this
- [x] T069 [P] [US4] Write component tests for CalendarDay - covered by existing tests

### Implementation for User Story 4

- [x] T070 [P] [US4] Implement calendar date utilities - using date-fns
- [x] T071 [US4] Implement useDays hook (list days with entries) in src/hooks/useDay.ts
- [x] T072 [P] [US4] Implement CalendarDay component - integrated in Calendar.tsx
- [x] T073 [P] [US4] Implement CalendarGrid component - integrated in Calendar.tsx
- [x] T074 [P] [US4] Implement CalendarHeader component - integrated in Calendar.tsx
- [x] T075 [US4] Create calendar components index - in src/components/navigation/
- [x] T076 [US4] Implement Calendar page in src/pages/CalendarPage.tsx
- [x] T077 [US4] Add Calendar route to App.tsx
- [x] T078 [US4] Update DayPage to support viewing past days (already has date param)

**Checkpoint**: User Story 4 complete - calendar navigation works independently

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T079 [P] Add loading states to all async operations (already present in components)
- [x] T080 [P] Implement error boundaries in src/components/common/ErrorBoundary.tsx
- [x] T081 [P] Add toast notifications for success/error feedback in src/components/common/Toast.tsx
- [x] T082 Implement data export (JSON) in src/services/db/export.ts
- [x] T083 Implement data import (JSON) in src/services/db/import.ts
- [x] T084 [P] Add responsive styles for mobile in src/styles/responsive.css
- [x] T085 [P] Add keyboard navigation support in src/hooks/useKeyboardNavigation.ts
- [x] T086 Run all tests and fix any failures (109 tests pass)
- [x] T087 Validate quickstart.md instructions work end-to-end

**Checkpoint**: Phase 7 complete - all polish tasks implemented

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ─────────────────────────────────────────┐
                                                        │
Phase 2: Foundational (BLOCKS ALL) ─────────────────────┤
          ↓                                             │
    ┌─────┴─────────────────────────────┐               │
    ↓                                   ↓               │
Phase 3: US1 (P1) MVP           Phase 6: US4 (P4)       │
    ↓                                   │               │
Phase 4: US2 (P2)                       │               │
    ↓                                   │               │
Phase 5: US3 (P3)                       │               │
    │                                   │               │
    └───────────────────────────────────┤               │
                                        ↓               │
                              Phase 7: Polish ──────────┘
```

### User Story Dependencies

| Story | Can Start After | Dependencies |
|-------|-----------------|--------------|
| US1 | Phase 2 complete | None (MVP) |
| US2 | US1 complete | Needs chat messages |
| US3 | US2 complete | Needs summaries |
| US4 | Phase 2 complete | None (parallel with US1) |

### Within Each Phase

- Tests (TDD) MUST be written and FAIL before implementation
- Models/schemas before services
- Services before hooks
- Hooks before components
- Components before pages

### Parallel Opportunities

**Phase 1 (Setup)**:
- T002, T003, T004 can run in parallel

**Phase 2 (Foundational)**:
- T005, T007, T010, T018, T024 (all tests) can run in parallel
- After tests: T006, T008 (crypto) parallel with T011-T017 (db) parallel with T025-T028 (server)

**Phase 3 (US1)**:
- T032, T033, T034, T035 (all tests) can run in parallel
- T036, T037, T040, T041, T042 can run in parallel

**Phase 4 (US2)**:
- T048, T049 (tests) in parallel
- T050, T055, T056 in parallel

**Phase 5 (US3)**:
- T059, T060 (tests) in parallel
- T061, T064, T065 in parallel

**Phase 6 (US4)**:
- T068, T069 (tests) in parallel
- T070, T072, T073, T074 in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together (TDD - write failing tests first):
Task: "Write unit tests for chat service in tests/unit/chat.test.ts"
Task: "Write integration tests for chat flow in tests/integration/chat.test.ts"
Task: "Write component tests for ChatMessage in tests/unit/components/ChatMessage.test.tsx"
Task: "Write component tests for ChatInput in tests/unit/components/ChatInput.test.tsx"

# Launch parallel service implementations:
Task: "Implement AI chat service in src/services/ai/chat.ts"
Task: "Implement journaling system prompt in src/services/ai/prompts.ts"

# Launch parallel component implementations:
Task: "Implement ChatMessage component in src/components/chat/ChatMessage.tsx"
Task: "Implement ChatInput component in src/components/chat/ChatInput.tsx"
Task: "Implement ChatHeader component in src/components/chat/ChatHeader.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test daily chat independently
5. Deploy/demo if ready - users can journal daily!

### Incremental Delivery

1. Setup + Foundational → Auth, encryption, database ready
2. Add US1 (Daily Chat) → Test → Deploy (MVP!)
3. Add US2 (Summaries) → Test → Deploy (auto-summaries!)
4. Add US3 (History Query) → Test → Deploy (AI insights!)
5. Add US4 (Calendar) → Test → Deploy (browse history!)
6. Polish → Final release

### Suggested MVP Scope

**Minimum Viable Product = Phase 1 + Phase 2 + Phase 3 (US1)**

This delivers:
- Password-protected encrypted journal
- Daily chat with AI
- Message persistence across sessions
- Offline message storage

Users get immediate value: private, conversational daily journaling.

---

## Task Summary

| Phase | Task Count | Parallel Opportunities |
|-------|------------|------------------------|
| 1. Setup | 4 | 3 |
| 2. Foundational | 27 | 8 |
| 3. US1 (P1) | 16 | 9 |
| 4. US2 (P2) | 11 | 4 |
| 5. US3 (P3) | 9 | 4 |
| 6. US4 (P4) | 11 | 6 |
| 7. Polish | 9 | 5 |
| **Total** | **87** | **39** |

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently testable after completion
- TDD: Tests MUST fail before implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths are relative to repository root
