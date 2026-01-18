# Data Model: Tailwind CSS + shadcn/ui Migration

**Note**: This feature is a UI migration and does not modify the persistence layer or backend data model.

## UI Component Props (New)

The migration introduces standardized props for shadcn/ui components.

### Common Props

Most interactive components will inherit standard HTML attributes and Radix UI props.

- **className**: `string` - For tailwind utility overrides (via `cn()` helper)
- **variant**: `string` - For component variants (e.g., `default`, `destructive`, `outline` for Buttons)
- **size**: `string` - For component sizing (e.g., `default`, `sm`, `lg`)

## State Management

No global state management changes required. Component-local state will be handled by Radix UI primitives (e.g., open/close state for Dialogs/Selects).
