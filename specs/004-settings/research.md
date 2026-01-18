# Research: User Settings Management

**Date**: 2026-01-17
**Feature**: User Settings Management
**Purpose**: Resolve technical unknowns and establish best practices before detailed design

## Technical Decisions

### 1. Settings Storage Strategy

**Decision**: Store settings in existing RxDB `settings` collection

**Rationale**:
- Settings collection already exists in 001-daily-journal-chat (contains OpenRouter API key)
- RxDB provides automatic encryption for sensitive data (API key)
- Consistent with existing architecture; no new storage mechanisms needed
- Supports offline-first requirement natively

**Alternatives Considered**:
- localStorage: Rejected due to lack of encryption and less structured data handling
- Separate settings database: Rejected as over-engineering; single RxDB database sufficient

**Implementation Notes**:
- Settings schema already defined in `src/types/entities.ts`
- Add `systemPrompt` field to existing Settings interface
- Use `src/services/db/settings.ts` for CRUD operations

---

### 2. System Prompt Storage and Application

**Decision**: Store custom system prompt in Settings; apply via AI service layer

**Rationale**:
- System prompt is user preference, fits naturally in Settings entity
- Existing AI chat service (`src/services/ai/chat.ts`) already accepts messages array
- Prompt customization doesn't require backend changes; client-side only

**Alternatives Considered**:
- Separate prompts collection: Rejected as unnecessary complexity for single prompt value
- Hard-coded prompts: Rejected; doesn't meet customization requirement

**Implementation Notes**:
- Default prompt stored as constant in `src/services/ai/prompts.ts`
- Settings service provides `getSystemPrompt()` returning custom or default
- Chat service injects system message at conversation start

---

###  3. Export/Import Format and Validation

**Decision**: Use JSON format with Zod schema validation; export/import already implemented in 001

**Rationale**:
- Export (`src/services/db/export.ts`) and import (`src/services/db/import.ts`) already exist
- Zod already used project-wide for validation; consistent approach
- JSON is human-readable, debuggable, and cross-platform compatible
- Existing implementation handles version validation and duplicate detection

**Alternatives Considered**:
- Binary format: Rejected; reduces transparency and debuggability
- CSV: Rejected; doesn't handle nested data structures (summaries with sections)
- Custom format: Rejected; standard JSON sufficient and already implemented

**Implementation Notes**:
- Reuse existing `exportJournalData()` and `importFromFile()` from 001
- UI components will call existing services; no new backend logic needed
- Export includes version metadata for forward/backward compatibility

---

### 4. Clear All Data Safety Mechanism

**Decision**: Multi-step confirmation with typed phrase

**Rationale**:
- Aligns with industry best practices (GitHub, AWS use similar patterns)
- Typed confirmation prevents accidental clicks
- Warning message + confirmation phrase provides two barriers to data loss
- Complies with constitution privacy principle (complete data deletion)

**Alternatives Considered**:
- Single confirmation dialog: Rejected; too easy to accidentally confirm
- Email verification: Rejected; no email system in app, violates offline requirement
- Irreversible delay (e.g., 30-day grace period): Rejected; adds complexity and doesn't align with local-only architecture

**Implementation Notes**:
- Confirmation modal with text input requiring exact phrase match
- Use `closeDatabase()` then clear IndexedDB directly for complete removal
- Redirect to setup page after deletion (reuses existing auth flow)

---

### 5. UI Components Structure

**Decision**: Feature-based component organization under `src/components/settings/`

**Rationale**:
- Matches existing pattern (`src/components/auth/`, `src/components/chat/`)
- Groups related components for maintainability
- Each section (API key, prompt, data management) encapsulated in dedicated component

**Alternatives Considered**:
- Monolithic SettingsPage component: Rejected; violates component decomposition best practices
- Shared components folder: Rejected; these components are settings-specific, not reusable elsewhere

**Implementation Notes**:
- `SettingsPage.tsx` as container; delegates sections to child components
- Each section component self-contained with local state
- Shared hooks (`useSettings`, `useToast`) for cross-cutting concerns

---

### 6. Toast Notifications for User Feedback

**Decision**: Implement lightweight toast system using existing `Toast.tsx` component from 001

**Rationale**:
- Toast component already created in Phase 7 of 001-daily-journal-chat
- Non-intrusive feedback for success/error states
- Matches modern web app UX patterns (vs alert() dialogs)

**Alternatives Considered**:
- alert()/confirm() dialogs: Rejected; poor UX, blocks interaction
- Inline error messages only: Rejected; users may miss feedback for asynchronous operations

**Implementation Notes**:
- `useToast` hook provides `showToast(message, type)` interface
- Toast types: success, error, info, warning (already defined in Toast.css)
- Auto-dismiss after 5 seconds with manual close option

---

## Best Practices Applied

### React Component Architecture
- **Separation of concerns**: UI components (views) separate from services (logic)
- **Custom hooks**: `useSettings` for settings management, `useToast` for notifications
- **Error boundaries**: Existing ErrorBoundary component will catch settings page errors

### TypeScript Strict Mode
- All new code uses strict type checking (already enabled project-wide)
- Zod schemas provide runtime validation matching TypeScript types
- No `any` types; use proper interfaces for all settings operations

### Testing Strategy (TDD)
- Unit tests for settings service (CRUD operations)
- Unit tests for validation logic (API key format, prompt length limits)
- Integration tests for SettingsPage (user interactions, export/import flow)
- Target: >90% coverage for critical paths (encryption, data deletion)

### Accessibility
- Settings form elements have proper labels and ARIA attributes
- Keyboard navigation for all interactive elements
- Focus management for modal dialogs (Clear Data confirmation)
- Color contrast meets WCAG AA standards (reuse existing CSS variables)

---

## Technical Risks and Mitigations

### Risk 1: Data Loss on Clear All Data
**Mitigation**: Multi-step confirmation + warning message; educate users upfront

### Risk 2: Invalid Import Files Breaking App
**Mitigation**: Zod validation before database writes; show clear error messages; existing implementation already handles this

### Risk 3: Large Export Files Causing Memory Issues
**Mitigation**: Use streaming JSON write if needed; current implementation tested with 1 year of data; monitor performance

---

## Dependencies on Existing Code

1. **RxDB Settings Collection**: `src/db/schemas/settings.schema.ts` (needs new `systemPrompt` field)
2. **Settings Service**: `src/services/db/settings.ts` (extend for prompt management)
3. **Export/Import Services**: `src/services/db/export.ts` and `import.ts` (already complete)
4. **useSettings Hook**: `src/hooks/useSettings.ts` (extend for prompt operations)
5. **Toast Component**: `src/components/common/Toast.tsx` (already exists)
6. **Layout Component**: Add "Settings" nav link to existing navigation

---

## Summary

All technical unknowns resolved. The settings feature builds directly on established patterns from 001-daily-journal-chat:
- Reuses RxDB for encrypted storage
- Reuses Zod for validation
- Reuses export/import services (no new backend logic)
- Follows existing React component structure
- Applies TDD methodology throughout

No new third-party dependencies required. Ready to proceed to Phase 1 (data model and contracts).
