# Quickstart: User Settings Management

**Date**: 2026-01-17 | **Branch**: `002-settings`

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- Completed feature 001-daily-journal-chat (base application must be functional)

## Setup

### 1. Install Dependencies

No new dependencies required. Use existing packages:

```bash
npm install
```

### 2. Start Development Servers

```bash
# Start both frontend (Vite) and backend (Express) concurrently
npm start
```

This runs:
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:3001 (Express API proxy)

### 3. Access Settings Page

1. Navigate to http://localhost:5173
2. Complete initial setup (password, API key) if not done
3. Click "Settings" in the navigation bar

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run both frontend and backend in development |
| `npm run dev` | Run frontend only (Vite) |
| `npm run server` | Run backend only (Express) |
| `npm test` | Run tests with Vitest |
| `npm run test:ui` | Run tests with Vitest UI |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run build` | Build for production |

## Project Structure

```text
src/
├── components/
│   └── settings/         # NEW: Settings UI components
│       ├── SettingsPage.tsx
│       ├── ApiKeySection.tsx
│       ├── PromptCustomization.tsx
│       ├── DataManagement.tsx
│       └── ClearDataConfirmation.tsx
├── services/
│   ├── settings/         # NEW: Settings business logic
│   │   ├── settings.service.ts
│   │   ├── data-management.service.ts
│   │   └── validation.ts
│   └── db/               # EXISTING: Export/import already implemented
│       ├── export.ts
│       └── import.ts
├── hooks/
│   ├── useSettings.ts    # EXISTING: Extend for system prompt
│   └── useToast.ts       # NEW: Toast notification hook
└── pages/
    └── SettingsPage.tsx  # NEW: Main settings page route

tests/
├── unit/
│   ├── settings.service.test.ts  # NEW
│   ├── data-management.test.ts   # NEW
│   └── validation.test.ts        # NEW
└── integration/
    └── SettingsPage.test.tsx     # NEW
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/db/schemas/settings.schema.ts` | RxDB settings schema (add `systemPrompt` field) |
| `src/types/entities.ts` | Settings interface (add `systemPrompt?: string`) |
| `src/services/settings/settings.service.ts` | Settings CRUD operations |
| `src/services/db/export.ts` | Data export logic (already exists) |
| `src/services/db/import.ts` | Data import logic (already exists) |
| `src/hooks/useSettings.ts` | Settings React hook (extend) |
| `src/components/settings/SettingsPage.tsx` | Main settings UI |

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Specific Test File

```bash
npm test -- src/services/settings/settings.service.test.ts
```

### TDD Workflow

Per the project constitution, follow TDD:

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass
3. **Refactor**: Clean up while tests pass

Example:
```bash
# 1. Write test in tests/unit/settings.service.test.ts
# 2. Run and verify it fails
npm test -- tests/unit/settings.service.test.ts

# 3. Implement in src/services/settings/settings.service.ts
# 4. Run and verify it passes
npm test -- tests/unit/settings.service.test.ts

# 5. Refactor if needed, ensure tests still pass
```

## Common Tasks

### Add Settings Page to Navigation

**File**: `src/components/common/Layout.tsx`

Add "Settings" link to navigation:

```typescript
const navItems = [
  { path: '/today', label: 'Today', shortcut: 'T' },
  { path: '/calendar', label: 'Calendar', shortcut: 'C' },
  { path: '/history', label: 'History', shortcut: 'H' },
  { path: '/settings', label: 'Settings', shortcut: 'S' }, // NEW
];
```

### Add Settings Route

**File**: `src/App.tsx`

Add route for settings page:

```typescript
<Route path="/settings" element={<SettingsPage />} />
```

### Extend Settings Schema

**File**: `src/db/schemas/settings.schema.ts`

Add `systemPrompt` field:

```typescript
systemPrompt: {
  type: 'string',
  default: '',
},
```

### Extend Settings Interface

**File**: `src/types/entities.ts`

Add `systemPrompt` field:

```typescript
export interface Settings {
  id: 'settings';
  openRouterApiKey?: string;
  systemPrompt?: string; // NEW
  timezone: string;
  setupComplete: boolean;
  createdAt: number;
}
```

### Test Export/Import Flow

```bash
# 1. Create some journal entries via the app
# 2. Go to Settings > Data Management
# 3. Click "Export Data" → saves reflekt-export-YYYY-MM-DD.json
# 4. Open browser DevTools > Application > IndexedDB > Delete "reflekt" database
# 5. Reload app → should go to setup page
# 6. Complete setup with same password
# 7. Go to Settings > Data Management
# 8. Click "Import Data" → select exported JSON file
# 9. Verify all data is restored
```

## Environment Variables

No new environment variables required. Uses existing configuration from 001-daily-journal-chat.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | Express server port |
| `VITE_APP_NAME` | No | Reflekt | App name shown in UI |

## Troubleshooting

### "Cannot update API key"
- Verify API key format starts with "sk-" and is at least 20 characters
- Check browser console for specific validation error

### "Import failed: Invalid file format"
- Ensure the file is a valid JSON file exported from this app
- Check the file wasn't corrupted during download
- Verify the export version matches (check `version` field in JSON)

### "Clear All Data" not working
- Ensure you typed the confirmation phrase exactly as shown
- Check browser console for database errors
- Try closing all tabs with the app and reopening

### Tests failing with RxDB errors
- Ensure test setup includes RxDB memory adapter
- Check `tests/setup.ts` for proper configuration
- Verify schemas are valid with `additionalProperties: false`

## Architecture Notes

- **Client-Side Only**: No new backend endpoints; all operations are local
- **Encrypted Storage**: API key and system prompt encrypted at rest via RxDB
- **Offline-Capable**: All settings operations work without internet
- **Reuses Existing Services**: Export/import services from 001-daily-journal-chat
- **TDD Required**: All new code must have tests written first

## Links

- [Feature Spec](./spec.md)
- [Implementation Plan](./plan.md)
- [Data Model](./data-model.md)
- [Service Contracts](./contracts/services.md)
- [Research Notes](./research.md)

## Next Steps

After completing this feature:

1. Run full test suite: `npm test`
2. Build for production: `npm run build`
3. Manual testing checklist:
   - [ ] Update API key
   - [ ] Customize system prompt
   - [ ] Test export with data
   - [ ] Test import restores data
   - [ ] Test Clear All Data with confirmation
4. Create pull request with branch `002-settings`
