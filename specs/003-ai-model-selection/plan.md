# Implementation Plan: AI Model Selection for Summarizer

**Branch**: `001-ai-model-selection` | **Date**: 2026-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ai-model-selection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Allow users to select their preferred AI model from OpenRouter's catalog (339+ models) for summarization. The feature fetches available models dynamically from the OpenRouter API, displays them with pricing and provider information in a searchable dropdown, persists the user's selection in the RxDB settings database, and uses the selected model when generating daily summaries. Includes graceful fallback to a curated model list when the API is unavailable.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode enabled)
**Primary Dependencies**: React 19.2, RxDB 16.21 (IndexedDB), Zod 4.3, React Router DOM 7.12
**Storage**: RxDB with IndexedDB (encrypted), existing Settings collection
**Testing**: Vitest 4.0.17, @testing-library/react 16.3.1
**Target Platform**: Web browser (Chrome, Firefox, Safari - modern browsers with IndexedDB support)
**Project Type**: Web application (frontend React + backend Express API proxy)
**Performance Goals**: Model list fetch <5s, search/filter results <100ms, settings page load <2s
**Constraints**: <200ms for journal operations (per constitution), model list must work offline with fallback, API key stored securely in encrypted RxDB
**Scale/Scope**: Single user application, ~10 UI components, 339+ models to handle in dropdown, local-first with optional cloud AI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Privacy-First ✅

- **User Data Protection**: Model selection preference is stored in encrypted RxDB (IndexedDB). No model preference data is transmitted to external services except when making the OpenRouter API call for fetching model list (which only requires API key, not journal data).
- **Local-First Storage**: Model preference persisted locally in RxDB. OpenRouter API calls are made client-side, no server-side storage of user preferences.
- **Third-Party Services**: OpenRouter API receives only the API key and model list request - no user journal content transmitted. Summary generation already uses OpenRouter, this feature just allows model selection.
- **Data Deletion**: Model preference can be reset/deleted through settings interface.

**Status**: ✅ PASS - Feature maintains privacy-first principle.

### Test-Driven Development ✅

- **TDD Methodology**: Tests will be written before implementation for:
  - Settings model extension (RxDB schema update)
  - Model fetching service (OpenRouter API client)
  - Model selection component (React UI)
  - Settings persistence (update/read operations)
  - Summary generation with selected model (API integration)
  - Fallback logic for API failures
- **Test Coverage**: Critical paths include encryption (existing), settings persistence (new), API integration (new). Target >90% coverage for new code.
- **Test Types**: Unit tests for services, integration tests for RxDB operations, component tests for UI.

**Status**: ✅ PASS - Feature will follow TDD workflow as mandated.

### Simplicity (YAGNI) ✅

- **Current Need**: Users need to select AI models to control cost/quality/speed tradeoffs. This is a validated need (specified in feature request).
- **Abstractions**: No new abstractions introduced beyond a single model selection service. Uses existing RxDB settings pattern.
- **Dependencies**: No new dependencies required - uses existing React, RxDB, Zod stack. OpenRouter API is already a dependency.
- **Configuration**: Single setting (model ID string), no complex configuration.
- **Complexity**: Straightforward CRUD operation on settings + API fetch. Minimal complexity for core functionality.

**Status**: ✅ PASS - Feature adds minimal complexity with clear user value.

### Quality Standards ✅

- **TypeScript Strict Mode**: Already enabled, will continue using strict types with no `any` types.
- **Error Handling**: User-facing errors for API failures (e.g., "Could not load model list. Using default models."), no internal details leaked.
- **Performance**: Settings page load <2s (well within 200ms journal operation requirement), model list fetch <5s (network operation, acceptable).
- **Accessibility**: Dropdown component will use semantic HTML with ARIA labels for screen reader support.

**Status**: ✅ PASS - Meets all quality standards.

**Overall Gate Status**: ✅ **PASS** - Proceeding to Phase 0 Research

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/                              # Frontend React application
├── components/                   # React components
│   └── settings/                 # Settings-related components (NEW)
│       └── ModelSelector.tsx     # AI model dropdown selector (NEW)
├── db/                           # RxDB database
│   └── schemas/                  # Database schemas
│       └── settings.schema.ts    # Settings schema (MODIFY - add summarizerModel field)
├── pages/                        # Page components
│   └── Settings.tsx              # Settings page (MODIFY - add model selector)
├── services/                     # Business logic services
│   ├── ai/                       # AI-related services
│   │   └── models.service.ts     # OpenRouter model fetching (NEW)
│   ├── db/                       # Database services
│   │   └── settings.ts           # Settings CRUD (MODIFY - add model methods)
│   └── settings/                 # Settings services
│       └── settings.service.ts   # Settings service (MODIFY - add model persistence)
└── types/                        # TypeScript type definitions
    └── entities.ts               # Entity types (MODIFY - add AIModel type)

server/                           # Backend Express API proxy
├── routes/                       # API routes
│   └── ai.ts                     # AI endpoints (MODIFY - use selected model for /summary)
└── index.ts                      # Server entry point (no changes)

tests/                            # Test files
├── integration/                  # Integration tests
│   └── model-selection.test.ts   # Model selection integration (NEW)
├── unit/                         # Unit tests
│   ├── models.service.test.ts    # Model service tests (NEW)
│   └── settings.service.test.ts  # Settings service tests (MODIFY)
└── component/                    # Component tests (if needed)
    └── ModelSelector.test.tsx    # Model selector component tests (NEW)
```

**Structure Decision**: Web application structure with frontend (src/) and backend (server/). This feature primarily modifies the frontend settings UI and adds a new model fetching service. The backend only needs minimal changes to use the selected model from settings when generating summaries. Follows existing patterns established in the codebase.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. Feature passes all gates without requiring complexity justification.
