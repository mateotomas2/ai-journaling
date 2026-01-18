# Service Contracts: User Settings Management

**Date**: 2026-01-17
**Feature**: User Settings Management

## Overview

This document defines the service layer interfaces for the settings feature. Since this is a client-side only feature, there are no REST API endpoints. Instead, we define TypeScript service interfaces.

---

## Settings Service

**Location**: `src/services/settings/settings.service.ts`

### `getSettings()`

Retrieves current application settings.

**Signature**:
```typescript
async function getSettings(): Promise<Settings | null>
```

**Returns**:
- `Settings` object if exists
- `null` if not initialized (should not happen after setup)

**Errors**: None (returns null on failure)

**Side Effects**: None (read-only)

---

### `updateApiKey(apiKey: string)`

Updates the OpenRouter API key.

**Signature**:
```typescript
async function updateApiKey(apiKey: string): Promise<void>
```

**Parameters**:
- `apiKey`: New API key (must start with "sk-", min 20 chars)

**Returns**: `void` (success)

**Errors**:
- `Error("Invalid API key format")` if validation fails
- `Error("Failed to update API key")` if database write fails

**Side Effects**:
- Writes to RxDB settings collection
- Encrypted automatically by RxDB

---

### `getSystemPrompt()`

Retrieves the current system prompt (custom or default).

**Signature**:
```typescript
async function getSystemPrompt(): Promise<string>
```

**Returns**: System prompt text (never null; returns default if custom not set)

**Errors**: None (always returns a value)

**Side Effects**: None (read-only)

---

### `updateSystemPrompt(prompt: string)`

Updates the custom system prompt.

**Signature**:
```typescript
async function updateSystemPrompt(prompt: string): Promise<void>
```

**Parameters**:
- `prompt`: New system prompt (max 5000 chars; empty string = use default)

**Returns**: `void` (success)

**Errors**:
- `Error("Prompt too long")` if exceeds 5000 characters
- `Error("Failed to update prompt")` if database write fails

**Side Effects**:
- Writes to RxDB settings collection
- Encrypted automatically by RxDB

---

### `resetSystemPrompt()`

Resets system prompt to application default.

**Signature**:
```typescript
async function resetSystemPrompt(): Promise<void>
```

**Parameters**: None

**Returns**: `void` (success)

**Errors**:
- `Error("Failed to reset prompt")` if database write fails

**Side Effects**:
- Sets `systemPrompt` field to empty string in database
- Next `getSystemPrompt()` call returns default

---

## Data Management Service

**Location**: `src/services/settings/data-management.service.ts`

### `exportAllData()`

Exports all journal data to JSON file.

**Signature**:
```typescript
async function exportAllData(): Promise<void>
```

**Parameters**: None

**Returns**: `void` (triggers browser download)

**Errors**:
- `Error("Export failed")` if data retrieval fails
- `Error("No data to export")` if database is empty (debatable; could export empty arrays)

**Side Effects**:
- Reads all data from RxDB (days, messages, summaries)
- Creates downloadable JSON file
- Filename: `reflekt-export-YYYY-MM-DD.json`

**Notes**: Uses existing `exportJournalData()` and `downloadExport()` from `src/services/db/export.ts`

---

### `importData(file: File)`

Imports journal data from JSON file.

**Signature**:
```typescript
async function importData(file: File): Promise<ImportResult>
```

**Parameters**:
- `file`: JSON file selected by user

**Returns**:
```typescript
{
  success: boolean;
  imported: { days: number; messages: number; summaries: number };
  skipped: { days: number; messages: number; summaries: number };
  errors: string[];
}
```

**Errors**:
- `Error("Invalid file format")` if not JSON
- `Error("Incompatible version")` if schema version mismatch
- Validation errors collected in `result.errors` array

**Side Effects**:
- Writes to RxDB (bulk insert)
- Skips duplicates (by ID)
- Atomic: all-or-nothing per entity type

**Notes**: Uses existing `importFromFile()` from `src/services/db/import.ts`

---

### `clearAllData()`

Permanently deletes all journal data and settings.

**Signature**:
```typescript
async function clearAllData(): Promise<void>
```

**Parameters**: None

**Returns**: `void` (success)

**Errors**:
- `Error("Failed to clear data")` if deletion fails

**Side Effects**:
- Closes RxDB connection
- Deletes IndexedDB database
- Clears localStorage (salt, API key if stored separately)
- **IRREVERSIBLE**

**Security**: This function should only be called after user confirmation. It performs complete data removal.

---

## Validation Service

**Location**: `src/services/settings/validation.ts`

### `validateApiKey(apiKey: string)`

Validates OpenRouter API key format.

**Signature**:
```typescript
function validateApiKey(apiKey: string): boolean
```

**Parameters**:
- `apiKey`: API key to validate

**Returns**:
- `true` if valid format
- `false` if invalid

**Validation Rules**:
1. Must start with "sk-"
2. Minimum length: 20 characters
3. No whitespace

**Side Effects**: None (pure function)

---

### `validateSystemPrompt(prompt: string)`

Validates system prompt.

**Signature**:
```typescript
function validateSystemPrompt(prompt: string): { valid: boolean; error?: string }
```

**Parameters**:
- `prompt`: System prompt to validate

**Returns**:
```typescript
{
  valid: boolean;
  error?: string; // Present if valid === false
}
```

**Validation Rules**:
1. Maximum length: 5000 characters
2. Minimum length: 0 (empty is valid, means "use default")

**Side Effects**: None (pure function)

---

## React Hooks

### `useSettings()`

**Location**: `src/hooks/useSettings.ts` (already exists; extend)

**Signature**:
```typescript
function useSettings(): {
  apiKey: string | null;
  systemPrompt: string | null;
  isLoading: boolean;
  updateApiKey: (key: string) => Promise<void>;
  updateSystemPrompt: (prompt: string) => Promise<void>;
  resetSystemPrompt: () => Promise<void>;
}
```

**Usage**:
```typescript
const { apiKey, updateApiKey, systemPrompt, updateSystemPrompt } = useSettings();
```

**State Management**:
- Loads settings on mount
- Reactively updates when settings change
- Handles loading and error states

---

### `useToast()`

**Location**: `src/hooks/useToast.ts` (NEW)

**Signature**:
```typescript
function useToast(): {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

**Usage**:
```typescript
const { showToast } = useToast();
showToast('Settings saved!', 'success');
```

**Behavior**:
- Displays toast notification
- Auto-dismisses after 5 seconds
- User can manually dismiss
- Stacks multiple toasts

---

## Component Props Interfaces

### `SettingsPageProps`

**Location**: `src/components/settings/SettingsPage.tsx`

```typescript
interface SettingsPageProps {
  // No props; page-level component
}
```

---

### `ApiKeySectionProps`

**Location**: `src/components/settings/ApiKeySection.tsx`

```typescript
interface ApiKeySectionProps {
  apiKey: string | null;
  onUpdate: (key: string) => Promise<void>;
  isLoading: boolean;
}
```

---

### `PromptCustomizationProps`

**Location**: `src/components/settings/PromptCustomization.tsx`

```typescript
interface PromptCustomizationProps {
  systemPrompt: string | null;
  onUpdate: (prompt: string) => Promise<void>;
  onReset: () => Promise<void>;
  isLoading: boolean;
}
```

---

### `DataManagementProps`

**Location**: `src/components/settings/DataManagement.tsx`

```typescript
interface DataManagementProps {
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<ImportResult>;
  onClearData: () => Promise<void>;
}
```

---

### `ClearDataConfirmationProps`

**Location**: `src/components/settings/ClearDataConfirmation.tsx`

```typescript
interface ClearDataConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

---

## Error Handling Contracts

### Error Types

All services throw standard `Error` objects with descriptive messages:

```typescript
// API Key Errors
"Invalid API key format" // Validation failed
"Failed to update API key" // Database write failed

// Prompt Errors
"Prompt too long" // Exceeds 5000 chars
"Failed to update prompt" // Database write failed

// Import Errors
"Invalid file format" // Not JSON
"Incompatible version" // Schema version mismatch
"Failed to import data" // Generic import error

// Export Errors
"Export failed" // Data retrieval failed
"No data to export" // Empty database (optional)

// Clear Data Errors
"Failed to clear data" // Deletion failed
```

### Error Presentation

UI components should:
1. Catch errors from service calls
2. Display user-friendly messages via toast notifications
3. Log errors to console for debugging (dev mode only)
4. Never expose internal details to user

---

## Summary

This feature has no REST API contracts (client-side only). Service contracts defined:
- **Settings Service**: CRUD for API key and system prompt
- **Data Management Service**: Export, import, clear operations
- **Validation Service**: Pure validation functions
- **React Hooks**: State management and side effects
- **Component Props**: Type-safe UI contracts

All services follow TypeScript strict mode and return Promises for async operations. Error handling is consistent across all services.

Next: Create quickstart.md with developer setup instructions.
