# Research & Decisions: Tailwind CSS + shadcn/ui Migration

**Decisions extracted from Clarifications and Constitution**

## Decision: Embrace shadcn/ui Styling (Option B)

- **Decision**: We will adopting shadcn/ui default styling patterns while applying our project's specific color tokens. We will not attempt to pixel-match individual legacy components if the shadcn standard offers a better experience.
- **Rationale**: Reduces migration effort ("fighting the framework"), ensures visual consistency within the new system, and provides a polished, accessible baseline.
- **Alternatives Considered**: 
  - *Option A (Exact Match)*: Rejected due to high effort and maintenance burden of overriding shadcn defaults.
  - *Option C (Hybrid)*: Rejected as it risks inconsistent UX.

## Decision: Component Mapping

- **Decision**: Validated the following mapping strategy:
  - `ModelSelector` -> `Combobox`
  - `MessageInput` -> `Textarea` + `Button`
  - Custom Toast -> `Sonner` (shadcn toast)
  - Custom Modal -> `AlertDialog`
  - Custom Dropdown -> `Select`
  - Links -> `Button` (ghost variant)
- **Rationale**: Maps legacy patterns to the most semantically appropriate Radix UI/shadcn primitive.

## Decision: Test Strategy

- **Decision**: Existing tests use Vitest with `jsdom` but do NOT use `data-testid` selectors (confirmed via codebase search). Migration will rely on:
  - Visual manual verification (Storybook-style)
  - Existing functional tests (ensuring no logic breakage)
  - Accessibility audits
- **Rationale**: No need to preserve `data-testid` as none exist. Functional tests should remain green as we are not changing business logic.

## Unknowns Resolved

- `TEST_RUNNER`: Confirmed as **Vitest** via `vite.config.ts`.
- `DATA_TESTID`: Confirmed **None** used in `src/`.
