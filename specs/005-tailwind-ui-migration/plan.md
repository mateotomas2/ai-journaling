# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Migrate the existing UI (30 custom CSS files, 34 TSX components) to use Tailwind CSS and shadcn/ui components. This involves installing the frameworks, configuring the theme system to match current branding (via tokens), and rewriting all styles to use utility classes and standardized components, ensuring visual coherence and dark mode support.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.x
**Primary Dependencies**: Tailwind CSS 3.x, shadcn/ui (Radix UI primitives), class-variance-authority, clsx, tailwind-merge
**Storage**: N/A (UI migration only)
**Testing**: Vitest (unit), Playwright (E2E) - Confirmed Vitest via vite.config.ts; no data-testid dependencies to preserve.
**Target Platform**: Web (modern browsers)
**Project Type**: Web application
**Performance Goals**: Zero regression in Core Web Vitals; build size increase ≤20KB
**Constraints**: Privacy-first (no analytics for UI), TDD mandated, Strict TypeScript
**Scale/Scope**: 30 CSS files, 34 Components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Analysis

1. **Privacy-First (I)**: ✅ Compliant. UI migration does not introduce telemetry. External fonts/assets must be self-hosted or justified (shadcn uses embedded or localizable assets).
2. **Test-Driven Development (II)**: ✅ **Compliant**. Visual regressions covered by manual verification + existing functional tests (Vitest) which will persist.
3. **Simplicity (III)**: ✅ Compliant. Removing 30 custom CSS files reduces maintenance burden. Centralized tokens simplify theming.
4. **UI Framework (IV)**: ✅ **Directly fulfilling this principle**. This feature implements the mandate to use Tailwind + shadcn/ui.

### Violations / Exemptions
No known violations. Complexity is justified by Principle IV (Mandate).

## Project Structure

### Documentation (this feature)

```text
specs/002-tailwind-ui-migration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (Next Step)
```

### Source Code

```text
src/
├── components/          # Migrating to shadcn/ui components
│   ├── ui/              # NEW: shadcn/ui primitives (button, input, etc.)
│   ├── auth/            # Feature components
│   ├── chat/            # Feature components
│   ├── common/          # Shared components
│   ├── navigation/      # Navigation components
│   ├── settings/        # Settings components
│   └── summary/         # Summary components
├── lib/                 # NEW: Utility functions (cn, utils)
├── styles/              # REMOVING: custom css files
├── hooks/
├── pages/
└── services/
```

**Structure Decision**: Standard React application structure with new `components/ui` folder for shadcn primitives and `lib/` for generic utilities, following shadcn/ui installation conventions.

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
