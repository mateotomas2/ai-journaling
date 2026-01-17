# Implementation Plan: Daily Journal Chat with AI Summaries

**Branch**: `001-daily-journal-chat` | **Date**: 2026-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-daily-journal-chat/spec.md`

## Summary

Build a conversational daily journaling web application where users chat with an AI to record journal entries, day insights, health status, and dreams. The system generates automatic daily summaries and enables historical queries across weeks/months of data. All data is stored locally in the browser (IndexedDB via RxDB) with password-derived encryption. AI features powered by OpenRouter (GPT-4o).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode enabled)
**Primary Dependencies**: React 19.2, Vite 7.3, RxDB 16.21 (IndexedDB), date-fns 4.1, Zod 4.3
**AI Integration**: OpenRouter API with GPT-4o (replaces existing Anthropic SDK)
**Storage**: RxDB with IndexedDB adapter; local-only, encrypted at rest
**Testing**: Vitest 4.0 with React Testing Library, jsdom environment
**Target Platform**: Modern browsers (Chrome 90+, Firefox 90+, Safari 15+); responsive for desktop and mobile
**Project Type**: Web application (static SPA + minimal Express proxy for OpenRouter API key security)
**Performance Goals**: Journal operations < 200ms; AI responses < 5s for chat, < 2 min for summary generation
**Constraints**: Local-only storage, password-derived encryption (PBKDF2), offline-capable for non-AI features, no server-side data persistence
**Scale/Scope**: Single user, unlimited journal days, ~90 days AI context window for historical queries

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Privacy-First ✅ PASS

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Data encrypted at rest | Password-derived key (PBKDF2) encrypts RxDB storage | ✅ |
| Local-first storage default | IndexedDB only, no cloud sync | ✅ |
| No telemetry without consent | No analytics included | ✅ |
| Third-party no journal content | OpenRouter receives chat for AI processing—user explicitly provides API key and consents | ⚠️ Justified |
| Cloud AI consent | User provides own OpenRouter key; explicit consent flow at setup | ✅ |
| Data deletion honored | Local-only; user can clear browser storage or delete via app | ✅ |

**Note**: OpenRouter receives journal content for AI processing. This is justified because:
1. User explicitly provides their own API key (opt-in)
2. User is warned at setup that AI features require sending data to OpenRouter
3. No data is stored server-side by our application

### II. Test-Driven Development ✅ PASS

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Tests before implementation | TDD workflow enforced via tasks.md structure | ✅ |
| Red-Green-Refactor cycle | Task structure: write test → implement → refactor | ✅ |
| PRs require tests | Enforced by review process | ✅ |
| Critical path coverage > 90% | Encryption, data handling, AI integration prioritized | ✅ Target |

### III. Simplicity (YAGNI) ✅ PASS

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Solve current validated need | All features from user spec, no extras | ✅ |
| No premature abstraction | Single-user, single-device, minimal layers | ✅ |
| Minimal dependencies | Using existing deps; adding only OpenRouter client | ✅ |
| Minimal configuration | Password + API key only; sensible defaults | ✅ |

### Quality Standards ✅ PASS

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| TypeScript strict mode | Already enabled in tsconfig.json | ✅ |
| Actionable errors | User-friendly messages, no internal leaks | ✅ Target |
| Operations < 200ms | IndexedDB operations typically < 50ms | ✅ |
| WCAG 2.1 AA | Responsive design, keyboard navigation, proper contrast | ✅ Target |

## Project Structure

### Documentation (this feature)

```text
specs/001-daily-journal-chat/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions and patterns
├── data-model.md        # Phase 1: Entity definitions and relationships
├── quickstart.md        # Phase 1: Developer onboarding guide
├── contracts/           # Phase 1: API schemas
│   └── openrouter.yaml  # OpenRouter API contract
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/          # React UI components
│   ├── chat/           # Chat interface components
│   ├── calendar/       # Day navigation components
│   ├── auth/           # Password/unlock components
│   └── common/         # Shared UI primitives
├── pages/              # Route-level page components
│   ├── DayChat.tsx     # Daily chat view
│   ├── Calendar.tsx    # Calendar/list navigation
│   ├── History.tsx     # Historical query interface
│   └── Setup.tsx       # First-time setup (password, API key)
├── services/           # Business logic
│   ├── ai/             # OpenRouter integration
│   ├── crypto/         # Encryption utilities (PBKDF2, AES)
│   ├── db/             # RxDB schema and operations
│   └── summary/        # Daily summary generation
├── hooks/              # React custom hooks
├── types/              # TypeScript type definitions
└── utils/              # Pure utility functions

server/
├── index.ts            # Express server entry
└── routes/
    └── ai.ts           # OpenRouter proxy endpoint

tests/
├── unit/               # Unit tests for services
├── integration/        # Integration tests (DB, AI)
└── e2e/                # End-to-end user flows
```

**Structure Decision**: Web application with frontend SPA (src/) and minimal backend proxy (server/). The backend exists solely to keep the OpenRouter API key secure (not exposed in browser). All data persistence is client-side via RxDB/IndexedDB.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Backend proxy server | Keep OpenRouter API key secure | Browser-only would expose API key in network requests |
| Password-derived encryption | Protect sensitive journal data | No protection would allow anyone with browser access to read journals |

**Note**: These are not constitution violations but justified complexity that serves the privacy-first principle.

## Constitution Check (Post-Design Re-evaluation)

*Re-evaluated after Phase 1 design completion.*

### Summary

All constitution principles remain satisfied after detailed design:

| Principle | Pre-Design | Post-Design | Notes |
|-----------|------------|-------------|-------|
| I. Privacy-First | ✅ PASS | ✅ PASS | Data model confirms encryption on all sensitive fields |
| II. Test-Driven Development | ✅ PASS | ✅ PASS | Quickstart documents TDD workflow |
| III. Simplicity (YAGNI) | ✅ PASS | ✅ PASS | No unnecessary abstractions in design |
| Quality Standards | ✅ PASS | ✅ PASS | Contracts define actionable error responses |

### Design Decisions Validated

1. **Encryption scope**: Data model specifies `encrypted: true` for `content`, `sections`, `rawContent`, and `openRouterApiKey` fields
2. **Minimal API surface**: Only 3 endpoints needed (`/chat`, `/summary`, `/query`)
3. **No premature abstraction**: Direct fetch to OpenRouter instead of AI framework wrapper
4. **TDD-ready**: Quickstart includes testing commands and TDD workflow documentation

### No New Violations Introduced

The detailed design phase did not introduce any new complexity beyond what was justified in the initial check.
