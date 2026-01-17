# Implementation Plan: User Settings Management

**Branch**: `002-settings` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-settings/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a Settings page to the journal application enabling users to manage OpenRouter API keys, customize AI chat prompts, export/import journal data for backup/migration, and clear all data with safety confirmations. This feature enhances user control, data portability, and application customization while maintaining privacy-first principles through local-only data operations.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode)
**Primary Dependencies**: React 19.2, React Router DOM 7.12, RxDB 16.21, Zod 4.3
**Storage**: RxDB (IndexedDB) with encryption
**Testing**: Vitest 4.0.17, React Testing Library 16.3
**Target Platform**: Browser (desktop and mobile, responsive)
**Project Type**: Web application (React SPA with Express proxy server)
**Performance Goals**: Settings operations complete in <1 second; export/import handle 1 year of data in <30 seconds
**Constraints**: Offline-capable for all settings operations; no external API calls except for OpenRouter validation
**Scale/Scope**: Single settings page; 4 main features (API key, prompt, export/import, clear); ~10 new components/services

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Privacy-First ✅

- **Encrypted storage**: API key and system prompt stored using existing RxDB encryption ✅
- **Local-first**: All settings operations are local-only; export/import doesn't require network ✅
- **No telemetry**: Settings changes don't send analytics; user retains full control ✅
- **Third-party protection**: API key only transmitted to OpenRouter when user initiates chat; not exposed to other services ✅
- **Data deletion**: Clear All Data function honors complete deletion requirement ✅

### II. Test-Driven Development ✅

- **TDD workflow**: Tests will be written first for all settings services and components ✅
- **Test coverage**: Critical paths (encryption, export/import validation, data clearing) will exceed 90% coverage ✅
- **No PR without tests**: All new functionality will have corresponding tests ✅

### III. Simplicity (YAGNI) ✅

- **Current need**: All features address validated user requirements from spec ✅
- **No premature abstraction**: Reusing existing patterns from 001-daily-journal-chat; no new abstractions ✅
- **Minimal dependencies**: Using existing Zod for validation; no new third-party packages required ✅
- **Sensible defaults**: System prompt has default value; API key uses existing storage; no excessive configuration ✅

**Result**: ✅ PASSED - No violations. Feature aligns with all constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/002-settings/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (React SPA + Express server)
src/
├── components/
│   ├── settings/         # NEW: Settings UI components
│   │   ├── SettingsPage.tsx
│   │   ├── ApiKeySection.tsx
│   │   ├── PromptCustomization.tsx
│   │   ├── DataManagement.tsx
│   │   └── ClearDataConfirmation.tsx
│   ├── common/           # Existing: Shared components (Layout, ErrorBoundary, Toast)
│   ├── auth/             # Existing: Password setup/unlock
│   └── chat/             # Existing: Chat interface components
├── services/
│   ├── settings/         # NEW: Settings business logic
│   │   ├── settings.service.ts
│   │   └── validation.ts
│   ├── db/               # Existing: RxDB operations (export.ts and import.ts already implemented in 001)
│   ├── ai/               # Existing: OpenRouter integration
│   └── crypto/           # Existing: Encryption utilities
├── hooks/
│   ├── useSettings.ts    # Existing: API key management
│   └── useToast.ts       # NEW: Toast notification hook
├── pages/
│   └── SettingsPage.tsx  # NEW: Main settings page
└── types/
    └── entities.ts       # Existing: Settings entity already defined

tests/
├── unit/
│   ├── settings.service.test.ts  # NEW
│   └── validation.test.ts        # NEW
└── integration/
    └── SettingsPage.test.tsx     # NEW

server/
└── [No changes needed - no new backend endpoints]
```

**Structure Decision**: Using existing web application structure (React SPA with Express server). Settings page follows established patterns from 001-daily-journal-chat. Export/import services already exist in `src/services/db/`; will be integrated into UI. No backend changes needed as all operations are client-side.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations detected. This section is empty.*

---

## Phase 1 Design Complete - Constitution Re-Check

*Re-evaluating constitution compliance after completing design artifacts (research.md, data-model.md, contracts/, quickstart.md)*

### I. Privacy-First ✅

**Post-Design Verification**:
- ✅ Data model confirms encrypted storage for sensitive fields (`openRouterApiKey`, `systemPrompt`)
- ✅ Export/import operates on local files only; no cloud transmission
- ✅ Clear All Data performs complete removal (IndexedDB delete, not soft delete)
- ✅ No new third-party services introduced; all operations remain local

**Result**: Still compliant ✅

### II. Test-Driven Development ✅

**Post-Design Verification**:
- ✅ Quickstart.md documents TDD workflow with examples
- ✅ Test structure defined in project layout (unit + integration tests)
- ✅ Service contracts clearly testable with defined inputs/outputs
- ✅ All new services have corresponding test files planned

**Result**: Still compliant ✅

### III. Simplicity (YAGNI) ✅

**Post-Design Verification**:
- ✅ No new dependencies added (confirmed in research.md)
- ✅ Reuses existing services (export.ts, import.ts from 001)
- ✅ Single Settings entity extension (one new field: `systemPrompt`)
- ✅ Component structure mirrors existing patterns (no new abstractions)
- ✅ Service layer follows existing conventions (async/await, error throwing)

**Result**: Still compliant ✅

---

**FINAL GATE RESULT**: ✅ PASSED

All constitution principles remain satisfied after detailed design. No complexity violations introduced. Ready to proceed to Phase 2 (task breakdown via `/speckit.tasks` command).

---

## Next Steps

1. ✅ Phase 0 complete: research.md created
2. ✅ Phase 1 complete: data-model.md, contracts/, quickstart.md created
3. ✅ Agent context updated (CLAUDE.md)
4. ✅ Constitution re-check passed
5. **Next**: Run `/speckit.tasks` to generate tasks.md with TDD-driven implementation plan
