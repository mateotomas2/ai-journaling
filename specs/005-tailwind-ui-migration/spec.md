# Feature Specification: Tailwind CSS + shadcn/ui Migration

**Feature Branch**: `002-tailwind-ui-migration`  
**Created**: 2026-01-18  
**Status**: Draft  
**Input**: User description: "Migrate existing UI to Tailwind CSS + shadcn/ui as per constitution v1.1.0"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visual Coherence After Migration (Priority: P1)

As a user, I expect the application to feel familiar but more polished after the UI framework migration. While exact pixel-perfection is not required, the layout, flow, and brand colors should remain consistent.

**Why this priority**: Users rely on muscle memory and brand familiarity. A migration should improve the UI (cleaner, more consistent) without disorienting users.

**Independent Test**: Can be fully tested by navigating through all pages and verifying that key user flows (chat, settings, calendar) work intuitively and look cohesive.

**Acceptance Scenarios**:

1. **Given** a user on the Today page, **When** they view the chat interface, **Then** the layout is preserved but components (inputs, buttons) use updated shadcn/ui styling
2. **Given** a user on the Settings page, **When** they interact with form controls, **Then** the controls use shadcn/ui styles but retain the project's color scheme
3. **Given** a user on any page, **When** they resize the browser window, **Then** responsive layouts adapt correctly and match the previous responsive behavior

---

### User Story 2 - Dark Mode Support (Priority: P2)

As a user, I want to use the application in dark mode so that I can journal comfortably in low-light environments and reduce eye strain.

**Why this priority**: Constitution v1.1.0 mandates dark mode support via Tailwind's `dark:` variant. This is a key benefit of the migration and improves accessibility.

**Independent Test**: Can be fully tested by toggling system dark mode preference and verifying all UI elements adapt appropriately with proper contrast ratios.

**Acceptance Scenarios**:

1. **Given** a user with system dark mode enabled, **When** they open the application, **Then** the UI displays with dark theme colors (dark backgrounds, light text)
2. **Given** a user in dark mode, **When** they view any page, **Then** all text maintains WCAG 2.1 AA contrast requirements
3. **Given** a user in dark mode, **When** they interact with buttons, inputs, and cards, **Then** focus states and hover effects are visible and appropriate for dark theme

---

### User Story 3 - Accessible Interactive Components (Priority: P2)

As a user relying on assistive technologies, I want all interactive elements to be fully accessible so that I can use the application effectively regardless of ability.

**Why this priority**: WCAG 2.1 AA compliance is mandated by the constitution. shadcn/ui components provide built-in accessibility that must be preserved and extended.

**Independent Test**: Can be tested using screen reader (VoiceOver/NVDA), keyboard-only navigation, and automated accessibility audits.

**Acceptance Scenarios**:

1. **Given** a user navigating with keyboard only, **When** they tab through the interface, **Then** all interactive elements are reachable and have visible focus indicators
2. **Given** a screen reader user, **When** they interact with form controls, **Then** labels and error messages are announced correctly
3. **Given** any user, **When** they use modal dialogs or dropdowns, **Then** focus is trapped appropriately and Escape key closes them

---

### User Story 4 - Consistent Design Token Usage (Priority: P3)

As a developer, I want all styling to use centralized design tokens so that future theming changes can be made in one place.

**Why this priority**: Maintainability benefit from the migration—design tokens in `tailwind.config.js` enable easy brand updates and theme customization.

**Independent Test**: Can be tested by modifying a design token (e.g., primary color) and verifying the change propagates to all components.

**Acceptance Scenarios**:

1. **Given** a developer modifying the primary color token, **When** the application rebuilds, **Then** all primary-colored elements reflect the new color
2. **Given** any component in the codebase, **When** inspected, **Then** styling uses Tailwind utility classes referencing design tokens, not hardcoded values

---

### Edge Cases

- What happens when a component needs styling not expressible via Tailwind utilities? (Constitution permits CSS variables and documented exceptions)
- How does dark mode transition handle user preference changes mid-session?
- What happens with third-party components that have their own styling?

## Clarifications

### Session 2026-01-18

- Q: Which shadcn/ui components should we adopt? → A: Combobox, Select, Input, Field, Toast, Spinner, Button, Card, and any other component useful for current UI patterns
- Q: Migration strategy: exact match vs embrace shadcn/ui? → A: Embrace shadcn/ui styling (Option B) - Adopt shadcn defaults with custom tokens; accept UI refresh

### Component Migration Mapping

The following table shows the mapping from existing custom implementations to shadcn/ui components:

| Current Component | Current Pattern | shadcn/ui Component | Notes |
|-------------------|-----------------|---------------------|-------|
| ModelSelector | Custom search + native select | **Combobox** | Search, filter, and select from model list |
| MessageInput | Native textarea + buttons | **Textarea** + **Button** | Chat input with send/stop actions |
| Toast/ToastProvider | Custom toast system | **Toast** (Sonner) | Notifications with auto-dismiss |
| Loading | Custom CSS spinner | **Spinner** | Loading states throughout app |
| ApiKeySection inputs | Native input elements | **Input** + **Button** | Form fields with edit/save actions |
| Settings forms | Native form elements | **Form** + **Field** | Labeled inputs with validation |
| ClearDataConfirmation | Custom modal | **AlertDialog** | Destructive action confirmation |
| DaySelector | Custom dropdown | **Select** | Date/day picker dropdown |
| Calendar | Custom calendar grid | **Calendar** | Date navigation |
| Navigation links | Custom styled links | **Button variant="ghost"** | Nav items with active states |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST install and configure Tailwind CSS with PostCSS
- **FR-002**: System MUST install and configure shadcn/ui component library
- **FR-003**: System MUST migrate all 30 existing CSS files to Tailwind utility classes
- **FR-004**: System MUST migrate interactive components to shadcn/ui primitives as defined in the Component Migration Mapping table above
- **FR-005**: System MUST preserve all existing CSS custom properties as design tokens in `tailwind.config.js`
- **FR-006**: System MUST implement dark mode support using Tailwind's `dark:` variant
- **FR-007**: System MUST maintain WCAG 2.1 AA accessibility compliance for all components
- **FR-008**: System MUST NOT use inline `style` attributes for component styling
- **FR-009**: System MUST NOT use custom CSS except for: CSS variables (theming), complex animations, and documented third-party overrides
- **FR-010**: System MUST preserve all existing responsive breakpoints and mobile-first design

### Key Entities

- **Design Tokens**: Color palette, spacing scale, typography, border radius, shadows—centralized in `tailwind.config.js`
- **Component Library**: Collection of shadcn/ui components adapted for Reflekt's design system
- **CSS Files**: 30 existing CSS files to be migrated and eventually removed

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All migrated components adopt shadcn/ui visual style while using project color tokens (visual coherence > strict consistency)
- **SC-002**: All interactive elements pass automated accessibility audit (Lighthouse accessibility score ≥95)
- **SC-003**: Dark mode is fully functional with all components supporting `dark:` variants
- **SC-004**: Zero custom CSS files remain except for permitted exceptions (animations, third-party overrides)
- **SC-005**: Build size increase is ≤20KB gzipped compared to current bundle
- **SC-006**: Page load performance (LCP, FID, CLS) shows no regression from pre-migration baseline
- **SC-007**: All existing E2E and unit tests pass without modification to test assertions
