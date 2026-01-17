# Feature Specification: User Settings Management

**Feature Branch**: `002-settings`
**Created**: 2026-01-17
**Status**: Draft
**Input**: User description: "add a settings tab, we can change - modify open router api key - Modify initial chat prompt - Nuke session - import/export all data"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modify OpenRouter API Key (Priority: P1)

As a user, I want to view and update my OpenRouter API key so I can maintain control over my AI service credentials and costs.

**Why this priority**: API key management is essential for the application to function. Without the ability to update the API key, users cannot change providers, rotate keys for security, or fix invalid key errors.

**Independent Test**: Can be fully tested by navigating to settings, viewing the current API key (masked), entering a new key, and verifying AI chat continues to work with the new credentials. Delivers immediate value as a security and maintenance feature.

**Acceptance Scenarios**:

1. **Given** I am in the settings page, **When** I view the API key section, **Then** I see my current API key masked (e.g., "sk-***********xyz")
2. **Given** I want to update my API key, **When** I enter a new valid OpenRouter API key and save, **Then** the new key is stored encrypted and the AI chat uses it for subsequent requests
3. **Given** I enter an invalid API key format, **When** I attempt to save, **Then** I see a validation error message
4. **Given** I have updated my API key, **When** I send a chat message, **Then** the system uses the new API key without requiring a page refresh
5. **Given** I enter a validly-formatted but inactive API key, **When** I send a chat message, **Then** I see an authentication error from the AI service indicating the key is invalid or has insufficient permissions

---

### User Story 2 - Customize Initial Chat Prompt (Priority: P2)

As a user, I want to customize the initial system prompt that guides the AI's behavior so I can personalize how the AI responds to my journaling style and preferences.

**Why this priority**: While not essential for basic functionality, custom prompts significantly improve user experience by allowing personalization of AI tone, focus areas, and response style.

**Independent Test**: Can be tested by navigating to settings, modifying the system prompt, starting a new day's chat, and observing that the AI responds according to the customized instructions. Delivers value as a personalization feature.

**Acceptance Scenarios**:

1. **Given** I am in the settings page, **When** I view the prompt customization section, **Then** I see the current system prompt used for daily chats
2. **Given** I want to change the AI's behavior, **When** I modify the system prompt and save, **Then** new chat sessions use the updated prompt
3. **Given** I have modified the system prompt, **When** I start a conversation on a new day, **Then** the AI responds according to my custom instructions
4. **Given** I want to revert changes, **When** I click "Reset to Default," **Then** the prompt returns to the original application default

---

### User Story 3 - Export and Import Journal Data (Priority: P3)

As a user, I want to export my journal data to a file and import it on another device or after reinstalling so I can backup and transfer my personal journal entries.

**Why this priority**: Data portability is important for user trust and data ownership, but less critical than core journaling functionality. Users typically need this occasionally rather than daily.

**Independent Test**: Can be tested by creating journal entries, exporting to JSON, clearing the database, importing the file, and verifying all data is restored. Delivers value as a backup and migration feature.

**Acceptance Scenarios**:

1. **Given** I have journal data, **When** I click "Export Data" in settings, **Then** a JSON file is downloaded containing all my days, messages, and summaries
2. **Given** I have an export file, **When** I click "Import Data" and select the file, **Then** the data is validated and imported into my local database
3. **Given** I import data with existing entries, **When** there are duplicate IDs, **Then** the system skips duplicates and reports how many were imported vs skipped
4. **Given** I select an invalid file format, **When** I attempt to import, **Then** I see a clear error message explaining the file is invalid

---

### User Story 4 - Clear All Data (Nuke Session) (Priority: P4)

As a user, I want to permanently delete all my journal data and start fresh so I can reset the application if needed or remove all personal information.

**Why this priority**: This is a destructive action needed only occasionally (e.g., selling device, starting over, testing). It's the lowest priority as it doesn't add new functionality, just a management capability.

**Independent Test**: Can be tested by creating journal entries, using the "Clear All Data" function with confirmation, and verifying the database is empty and the app returns to the initial setup state. Delivers value as a data management feature.

**Acceptance Scenarios**:

1. **Given** I want to delete all my data, **When** I click "Clear All Data" in settings, **Then** I see a prominent warning with a confirmation dialog
2. **Given** I am in the confirmation dialog, **When** I type the required confirmation phrase (e.g., "DELETE ALL DATA") and confirm, **Then** all journal data, settings, and API key are permanently deleted
3. **Given** I have cleared all data, **When** the operation completes, **Then** I am redirected to the initial setup page (password creation)
4. **Given** I accidentally click "Clear All Data," **When** I cancel the confirmation dialog, **Then** no data is deleted and I return to settings

---

### Edge Cases

- What happens if I enter an API key that works but belongs to a different OpenRouter account? (System uses it successfully; user is responsible for managing their account)
- What happens if I export data but the download fails partway? (User must manually retry export; system does not automatically retry failed downloads. Partial downloads will fail import validation)
- What happens if I import data while offline? (Import works locally; no network required as it's all local database operations)
- What happens if I customize the system prompt with invalid instructions or very long text? (System accepts any text up to a reasonable limit, e.g., 5000 characters; AI behavior may vary)
- What happens if I click "Clear All Data" and close the browser during the operation? (Operation may be incomplete; next launch may show inconsistent state requiring another clear or database re-initialization)
- What happens if I try to import an export file from a much older or newer version of the app? (System validates schema version and rejects incompatible formats with an error message)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Settings page accessible from the main navigation
- **FR-002**: System MUST display the current OpenRouter API key in masked format (showing only last 4 characters)
- **FR-003**: Users MUST be able to update their OpenRouter API key and have it stored encrypted locally
- **FR-004**: System MUST validate API key format before saving (basic format check, not API verification)
- **FR-005**: System MUST display the current system prompt used for AI chat sessions
- **FR-006**: Users MUST be able to modify the system prompt and save changes
- **FR-007**: System MUST provide a "Reset to Default" option for the system prompt
- **FR-008**: System MUST allow users to export all journal data (days, messages, summaries) to a JSON file
- **FR-009**: System MUST allow users to import journal data from a previously exported JSON file
- **FR-010**: System MUST validate imported data structure and report any errors
- **FR-011**: System MUST skip duplicate entries during import (based on IDs) and report import statistics
- **FR-012**: System MUST provide a "Clear All Data" function with prominent warning and confirmation
- **FR-013**: Confirmation for data clearing MUST require typing a confirmation phrase to prevent accidental deletion
- **FR-014**: System MUST delete all journal data, settings, and API key when "Clear All Data" is confirmed
- **FR-015**: System MUST redirect to initial setup (password creation) after successful data clearing
- **FR-016**: All settings changes MUST persist immediately (no manual save required unless specified)

### Key Entities

- **Setting**: Represents a configurable application parameter; includes OpenRouter API key (encrypted), system prompt text, and other user preferences
- **Export Package**: A JSON file containing all user data (days, messages, summaries) with version metadata for import validation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can update their OpenRouter API key in under 30 seconds
- **SC-002**: Users can export their complete journal data in under 10 seconds for typical usage (1 year of daily entries: ~365 days, ~3,650 messages, ~365 summaries)
- **SC-003**: Users can import a data file and restore their journal in under 30 seconds for typical data volumes (1 year of daily entries)
- **SC-004**: 100% of valid export files can be successfully imported without data loss
- **SC-005**: Zero accidental data deletions occur due to clear warnings and confirmation requirements
- **SC-006**: Custom system prompts are applied to new chat sessions within 1 second of saving
- **SC-007**: Users can complete all settings tasks without requiring external documentation or support
- **SC-008**: Export and import operations complete successfully with large data volumes (5 years of daily entries: ~1,825 days, ~18,250 messages, ~1,825 summaries) in under 60 seconds each

### Performance Baselines

- **Typical usage**: 1 year of daily journaling = approximately 365 days, 3,650 messages (avg 10 per day), 365 summaries
- **Large volume**: 5 years of daily journaling = approximately 1,825 days, 18,250 messages, 1,825 summaries
- **Standard hardware**: 2019 or newer laptop/desktop with minimum 8GB RAM, or modern mobile device (2020+ smartphone/tablet)
