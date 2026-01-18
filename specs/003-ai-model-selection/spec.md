# Feature Specification: AI Model Selection for Summarizer

**Feature Branch**: `001-ai-model-selection`
**Created**: 2026-01-18
**Status**: Draft
**Input**: User description: "Add AI model selection dropdown in settings for the summarizer. Persist selection and use when generating summaries."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Preferred AI Model (Priority: P1)

A user wants to choose which AI model generates their daily summaries, allowing them to balance cost, speed, and quality based on their preferences.

**Why this priority**: This is the core value of the feature - giving users control over the AI model used for summarization. Without this, the feature has no purpose.

**Independent Test**: Can be fully tested by navigating to settings, selecting a model from the dropdown, saving, and verifying the selection persists when returning to settings. Delivers immediate user value by allowing model preference configuration.

**Acceptance Scenarios**:

1. **Given** user is on the settings page, **When** they open the AI model dropdown, **Then** they see a list of available models with clear names and descriptions
2. **Given** user selects a different model from the dropdown, **When** they save settings, **Then** the selected model is persisted and shown when they return to settings
3. **Given** user has never configured a model, **When** they view settings, **Then** they see the current default model pre-selected in the dropdown

---

### User Story 2 - Generate Summaries with Selected Model (Priority: P2)

A user wants their daily summaries to be generated using their chosen AI model, ensuring their preference is respected for all future summarization tasks.

**Why this priority**: This delivers the functional benefit of the user's model selection. While critical for user satisfaction, it depends on P1 being implemented first.

**Independent Test**: Can be tested by selecting a specific model in settings, triggering a summary generation, and verifying the correct model is used in the API call. Delivers value by honoring user preferences during actual usage.

**Acceptance Scenarios**:

1. **Given** user has selected a specific model in settings, **When** they generate a daily summary, **Then** the summary is created using their chosen model
2. **Given** user has not selected a model, **When** they generate a summary, **Then** the system uses the default model (current: openai/gpt-4o)
3. **Given** user changes their model selection, **When** they generate a new summary, **Then** the new model is used immediately without requiring page refresh

---

### User Story 3 - Browse Available Models (Priority: P3)

A user wants to browse the complete list of available AI models from OpenRouter (hundreds of options) to find the best model for their summarization needs.

**Why this priority**: With 339+ models available, users need the ability to explore options. While valuable for power users, basic functionality works with just seeing a curated subset.

**Independent Test**: Can be tested by opening the model selector and verifying that models are loaded from the OpenRouter API. Users can scroll through the list and see model names. Delivers value by providing access to the full model catalog.

**Acceptance Scenarios**:

1. **Given** user opens the model selection dropdown, **When** the settings page loads, **Then** available models are fetched from the OpenRouter API
2. **Given** the OpenRouter API is reachable, **When** user opens the dropdown, **Then** they see a comprehensive list of available models with names
3. **Given** user is browsing models, **When** they scroll through the list, **Then** they can view all available options

---

### User Story 4 - Understand Model Differences (Priority: P4)

A user wants to understand the differences between available AI models (cost, capabilities, provider) so they can make an informed choice based on their needs.

**Why this priority**: This enhances decision-making quality but is not essential for basic functionality. Users can still select and use models without detailed comparison information.

**Independent Test**: Can be tested by reviewing the model dropdown to ensure each option shows pricing and provider information. Delivers value through improved decision-making.

**Acceptance Scenarios**:

1. **Given** user opens the model selection dropdown, **When** they review the options, **Then** each model shows its provider (OpenAI, Anthropic, Google, etc.) and a clear name
2. **Given** user is viewing a model option, **When** they examine the details, **Then** they can see the pricing per token for that model
3. **Given** user compares multiple models, **When** they review the list, **Then** they can distinguish between budget, mid-range, and premium options

---

### Edge Cases

- What happens when a user's saved model becomes unavailable or is deprecated by the AI provider?
- How does the system handle settings persistence if the database is corrupted or reset?
- What happens if a user triggers summary generation while simultaneously changing their model preference?
- How does the system behave if the selected model returns an error during summary generation?
- What happens when the OpenRouter API is unavailable or returns an error when fetching the model list?
- How does the system handle network timeouts when fetching models?
- What happens if the API returns an incomplete or malformed model list?
- How should the system behave for users with slow internet connections when loading hundreds of models?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dropdown selector in the settings interface for AI model selection
- **FR-002**: System MUST persist the user's selected AI model in the settings database
- **FR-003**: System MUST use the user's selected model when generating daily summaries
- **FR-004**: System MUST display the currently selected model in the settings dropdown when the page loads
- **FR-005**: System MUST fall back to a default model (openai/gpt-4o) when no model has been explicitly selected
- **FR-006**: System MUST fetch the list of available models from the OpenRouter API endpoint
- **FR-007**: System MUST display model information including model ID, display name, and provider for each available model
- **FR-008**: System MUST handle API failures gracefully by displaying a fallback list of commonly used models (openai/gpt-4o, openai/gpt-4o-mini, openai/gpt-3.5-turbo, anthropic/claude-sonnet-4.5, google/gemini-2.5-flash) when the OpenRouter API is unavailable
- **FR-009**: System MUST display pricing information (cost per prompt token) for each model when available from the API
- **FR-010**: System MUST allow users to search or filter the model list to find specific models by name or provider
- **FR-011**: Settings page MUST validate that a model selection is made before allowing save
- **FR-012**: System MUST handle cases where a previously saved model is no longer available by showing a warning and suggesting the default model

### Key Entities

- **Settings**: Extended to include a new field for storing the selected summarizer AI model identifier. This field should store the model string (e.g., "openai/gpt-4o") and be optional to support backward compatibility.
- **AI Model**: Represents an available AI model from the OpenRouter API, including:
  - Model ID (unique identifier like "openai/gpt-4o")
  - Display name (user-friendly name like "OpenAI: GPT-4o")
  - Provider name (extracted from display name or ID, e.g., "OpenAI", "Anthropic", "Google")
  - Pricing information (cost per prompt token and completion token)
  - Context length and other metadata from the API

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view and select from available AI models in under 30 seconds from opening settings
- **SC-002**: Model list loads from OpenRouter API within 5 seconds under normal network conditions
- **SC-003**: Selected model preference persists across browser sessions and page refreshes without data loss
- **SC-004**: Summary generation uses the correct user-selected model 100% of the time after model preference is saved
- **SC-005**: Users with no saved model preference receive summaries generated using the default model without errors
- **SC-006**: Model selection changes take effect immediately for the next summary generation without requiring application restart
- **SC-007**: Users can find a specific model within 10 seconds using search or filter functionality
- **SC-008**: When the OpenRouter API is unavailable, users can still access and select from a fallback list of popular models without application errors
