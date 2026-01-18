# Tasks: Tailwind CSS + shadcn/ui Migration

**Input**: Design documents from `/home/mat/mat/projects/ai-journaling/specs/002-tailwind-ui-migration/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Install Tailwind CSS and dependencies dev dependencies in package.json
- [x] T002 Initialize shadcn/ui (creates components.json, lib/utils.ts, src/components/ui)
- [x] T003 [P] Verify development server runs with new configuration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Analysis: Extract all colors and fonts from `src/index.css` and existing variables
- [x] T005 Update `tailwind.config.js` with extracted project tokens (colors, font, radius)
- [x] T006 Update `src/index.css` to define CSS variables for shadcn/ui compatibility (base layer)
- [x] T007 Install shadcn primitive: Button (`npx shadcn@latest add button`)
- [x] T008 Install shadcn primitive: Input (`npx shadcn@latest add input`)
- [x] T009 Install shadcn primitive: Textarea (`npx shadcn@latest add textarea`)
- [x] T010 Install shadcn primitive: Select (`npx shadcn@latest add select`)
- [x] T011 Install shadcn primitive: Dialog/AlertDialog (`npx shadcn@latest add dialog alert-dialog`)
- [x] T012 Install shadcn primitive: Card (`npx shadcn@latest add card`)
- [x] T013 Install shadcn primitive: Popover/Command (for Combobox) (`npx shadcn@latest add popover command`)
- [x] T014 Install shadcn primitive: Toast (Sonner) (`npx shadcn@latest add sonner`)
- [x] T015 [P] Create/Update `src/components/common/Loading.tsx` to use a lucide-react Spinner or similar standard loader

**Checkpoint**: Foundation ready - shadcn installed, tokens configured, primitives available.

---

## Phase 3: User Story 1 - Visual Coherence After Migration (Priority: P1) 🎯 MVP

**Goal**: Migrate key pages and components to use the new system, ensuring layout and flow remain consistent.

**Independent Test**: Navigate Today, Chat, and Settings pages; verify they look polished and functional.

- [x] T016 [US1] Migrate `src/components/common/Layout.tsx` and `src/components/common/Layout.css` to Tailwind
- [x] T017 [US1] Migrate `src/components/chat/MessageInput.tsx` to use Textarea + Button (remove CSS file)
- [x] T018 [US1] Migrate `src/components/chat/MessageBubble.tsx` to Tailwind (remove CSS file)
- [x] T019 [US1] Migrate `src/components/chat/MessageList.tsx` to Tailwind (remove CSS file)
- [x] T020 [US1] Migrate `src/components/chat/ChatInterface.tsx` to Tailwind (remove CSS file)
- [x] T021 [US1] Migrate `src/components/settings/ModelSelector.tsx` to use Combobox pattern (remove CSS file)
- [x] T022 [US1] Migrate `src/components/settings/ApiKeySection.tsx` to use Input + Button (remove CSS file)
- [x] T023 [P] [US1] Migrate pages: `TodayPage.tsx`, `HistoryPage.tsx`, `SettingsPage.tsx` to Tailwind containers
- [x] T024 [P] [US1] Migrate `src/components/navigation/` components (Calendar, DaySelector) to Tailwind

**Checkpoint**: Primary UI (Chat, Settings, Navigation) migrated. Visual coherence achieved.

---

## Phase 4: User Story 2 - Dark Mode Support (Priority: P2)

**Goal**: Enable full dark mode support across the application.

**Independent Test**: Toggle system dark mode; verify UI adapts correctly.

- [x] T025 [US2] Update `src/components/ui/*.tsx` components to ensure `dark:` classes are present (default in shadcn)
- [x] T026 [US2] Audit all migrated custom components for `dark:` utility usage (backgrounds, text colors)
- [x] T027 [US2] Verify `index.css` CSS variables handle dark mode values correctly
- [x] T028 [US2] Test and fix any contrast issues in dark mode on Chat and Settings pages

**Checkpoint**: Dark mode fully functional.

---

## Phase 5: User Story 3 - Accessible Interactive Components (Priority: P2)

**Goal**: Ensure all interactive elements meet WCAG 2.1 AA standards.

**Independent Test**: Keyboard navigation and screen reader verification.

- [x] T029 [US3] Verify focus states on all Button, Input, and Select components (visible outline)
- [x] T030 [US3] Ensure `ModelSelector` (Combobox) is keyboard navigable
- [x] T031 [US3] Ensure `MessageInput` supports correct key bindings (Enter to send, Shift+Enter for newline)
- [x] T032 [US3] Audit `aria-label` and `role` attributes on all migrated components

**Checkpoint**: Accessibility verified.

---

## Phase 6: User Story 4 - Consistent Design Token Usage (Priority: P3)

**Goal**: Cleanup and standardization of styling.

**Independent Test**: Codebase search reveals no hardcoded colors or custom CSS files.

- [ ] T033 [US4] Remove all legacy `.css` files from `src/components/*` and `src/pages/*`
- [ ] T034 [US4] Scan codebase for hardcoded hex values; replace with Tailwind classes/variables
- [ ] T035 [US4] Final polish of `index.css` (remove unused custom classes)

**Checkpoint**: Clean codebase, pure Tailwind/shadcn.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T036 Verify build size and performance
- [ ] T037 Update documentation (README, etc.) if needed regarding new UI stack
- [ ] T038 Run full test suite (Vitest + Playwright) to ensure no regressions

---

## Dependencies & Execution Order

1. **Setup (Phase 1)**: Blocks everything.
2. **Foundational (Phase 2)**: Blocks all User Stories.
3. **User Story 1**: Blocks nothing (MVP).
4. **User Story 2 & 3**: Can be parallelized after US1, or done in parallel with US1 components.
5. **User Story 4**: Cleanup phase, do last.

## Implementation Strategy

1. **Foundation**: Get the system running with shadcn/ui.
2. **MVP**: Migrate the Chat flow (Layout -> MessageInput -> Bubble -> List) + Settings (ModelSelector).
3. **Iterate**: Do Dark Mode + A11y checks.
4. **Cleanup**: Delete old CSS.
