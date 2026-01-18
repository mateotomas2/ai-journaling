# Feature Specification: Chat Interface Model Selector

**Feature Branch**: `001-chat-model-selector`
**Created**: 2026-01-18
**Status**: Draft
**Input**: User description: "Add model selection dropdown in the chat interface. Selection should persist across sessions stored in settings where you can also change the default model. Follow the same approach we did for the summarizer and add the same model selector icon next to the generate summary button. It should be a small icon that opens a popup with the model selection combobox."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Model Selection in Chat (Priority: P1)

Users can quickly change the AI model used for chat conversations directly from the chat interface without navigating to settings. This provides immediate control over conversation quality, cost, and performance trade-offs.

**Why this priority**: Core functionality that delivers immediate value - users can switch models mid-conversation based on their needs (faster responses vs. higher quality).

**Independent Test**: Can be fully tested by opening a chat, clicking the model selector icon, choosing a different model, sending a message, and verifying the selected model is used. Delivers standalone value even without settings page integration.

**Acceptance Scenarios**:

1. **Given** a user is viewing the chat interface, **When** they click the model selector icon, **Then** a popup appears showing available AI models with searchable list
2. **Given** the model selector popup is open, **When** the user selects a different model, **Then** the popup closes and the new model is immediately active for subsequent messages
3. **Given** a user has selected a model in chat, **When** they refresh the page or return later, **Then** their last selected model is still active
4. **Given** a user is viewing the chat interface, **When** they look at the model selector icon area, **Then** they can see which model is currently selected without opening the popup

---

### User Story 2 - Default Model Configuration in Settings (Priority: P2)

Users can set their preferred default chat model from the settings page. This default is used for new chat sessions and provides a central location for all model preferences alongside the existing summarizer model setting.

**Why this priority**: Enhances User Story 1 by providing centralized control. Lower priority because chat interface selector (P1) already provides model switching capability.

**Independent Test**: Can be tested by navigating to settings, changing the default chat model, starting a new chat session, and verifying the selected default is used. Works independently of inline selector.

**Acceptance Scenarios**:

1. **Given** a user opens the settings page, **When** they view the model selection section, **Then** they see separate selectors for "Chat Model" and "Summarizer Model"
2. **Given** a user changes the default chat model in settings, **When** they start a new chat session (fresh page load with no prior selection), **Then** the chat uses the configured default model
3. **Given** a user has previously selected a model in the chat interface, **When** they change the default in settings, **Then** the chat interface selection takes precedence (settings default only applies to fresh sessions)

---

### User Story 3 - Visual Consistency with Summarizer (Priority: P3)

The chat model selector uses the same visual design and interaction patterns as the existing summarizer model selector, creating a consistent user experience across the application.

**Why this priority**: Polish and UX consistency. Important for professional feel but doesn't add new functional value.

**Independent Test**: Can be tested by comparing the visual appearance, icon placement, popup behavior, and interaction patterns between the chat model selector and the summarizer model selector.

**Acceptance Scenarios**:

1. **Given** a user views both the chat interface and summary section, **When** they compare the model selector icons, **Then** both use the same icon style and size
2. **Given** a user opens both model selector popups, **When** they compare the interaction patterns, **Then** both use the same combobox with search functionality and identical layout

---

### Edge Cases

- What happens when the stored chat model ID is no longer available in the models list (model deprecated/removed)?
- What happens when the models API fails to load?
- What happens when a user has never selected a chat model (first-time user)?
- What happens when multiple browser tabs are open and a user changes the model in one tab?
- What happens if a user selects a model while a message is being generated?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a model selector icon in the chat interface header area
- **FR-002**: Model selector icon MUST open a popup containing a searchable list of available AI models when clicked
- **FR-003**: Users MUST be able to search/filter models by name, provider, or ID in the popup
- **FR-004**: System MUST display each model's name, provider, and pricing information in the selection list
- **FR-005**: System MUST visually indicate which model is currently selected
- **FR-006**: System MUST persist the user's chat model selection across browser sessions
- **FR-007**: System MUST use the selected chat model for all subsequent chat messages until changed
- **FR-008**: Settings page MUST include a "Chat Model" selector separate from the existing "Summarizer Model" selector
- **FR-009**: System MUST use the settings default chat model for new sessions when no previous selection exists
- **FR-010**: System MUST handle missing/deprecated model IDs by falling back to a reasonable default (e.g., 'openai/gpt-4o')
- **FR-011**: System MUST handle model API loading failures by displaying fallback model list
- **FR-012**: Chat model selection MUST take precedence over settings default (settings only applies to fresh sessions)

### Key Entities

- **Chat Model Selection**: The currently active AI model for chat conversations, stored per-user and persisting across sessions (separate from summarizer model selection)
- **Default Chat Model**: User's preferred default model configured in settings, used for new sessions when no prior selection exists

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch chat models in under 3 seconds (icon click → model selection → popup close)
- **SC-002**: Chat model selection persists across browser sessions with 100% reliability
- **SC-003**: Model selector handles API failures gracefully without blocking user interaction
- **SC-004**: Visual design matches existing summarizer selector (verified by side-by-side comparison)
- **SC-005**: Users can successfully select from all available models in the list

## Assumptions

- Using the same Popover/Command combobox pattern as the existing ModelSelector component
- Using lucide-react icons (specifically ChevronsUpDown for dropdown trigger, Check for selected state)
- Storing chat model selection in the existing RxDB Settings collection (new field: `chatModel`)
- Using the existing fetchModels() API and FALLBACK_MODELS pattern for resilience
- Icon button will use shadcn/ui Button with `size="icon"` variant for compact display
- Default chat model when none selected: 'openai/gpt-4o' (same as summarizer default)
- Model selector icon placed in chat interface header, near other action buttons
- No need to interrupt in-progress message generation when model is changed (applies to next message)
- Browser tab synchronization handled automatically by RxDB's real-time sync capabilities
