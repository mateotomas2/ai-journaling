# Feature Specification: Daily Journal Chat with AI Summaries

**Feature Branch**: `001-daily-journal-chat`
**Created**: 2026-01-16
**Status**: Draft
**Input**: User description: "build an application that every day lets the user introduce a journal, day insights, health status, dreams. The user will talk to a chat that is specific for that day. After each day there will be a summary of each day and that resume will be available for the AI memory in a way that you can ask for last weeks/months summaries or reports."

## Clarifications

### Session 2026-01-16

- Q: Which AI provider and model should be used? → A: OpenRouter with GPT-4o models
- Q: What platform/tech stack should be used? → A: Web app (browser-based, cross-platform)
- Q: Where should journal data be stored? → A: Local-only (IndexedDB, no server sync)
- Q: How should journal data be protected? → A: Password-protected (encryption key derived from user password)
- Q: What happens if user forgets password? → A: No recovery possible; warn user clearly at setup

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Daily Journal Entry via Chat (Priority: P1)

As a user, I want to have a conversational chat interface for each day where I can naturally share my journal entries, day insights, health status, and dreams without rigid form structures.

**Why this priority**: This is the core functionality - without the daily chat interface, users cannot interact with the application at all. It delivers the primary value proposition of conversational journaling.

**Independent Test**: Can be fully tested by opening the app, selecting today's date, and having a conversation about the day's events. Delivers immediate value as a personal journal.

**Acceptance Scenarios**:

1. **Given** I open the application, **When** I select today's date, **Then** I see a chat interface dedicated to today's journal
2. **Given** I am in today's chat, **When** I type a message about my day, **Then** the AI responds conversationally and acknowledges my entry
3. **Given** I am in today's chat, **When** I share my health status (e.g., "I slept 7 hours, feeling tired"), **Then** the AI recognizes and categorizes this as health information
4. **Given** I am in today's chat, **When** I describe a dream, **Then** the AI acknowledges it as a dream entry and may ask follow-up questions
5. **Given** I have an existing chat for today, **When** I return later in the day, **Then** I can continue the same conversation with full context preserved

---

### User Story 2 - Automatic Daily Summaries (Priority: P2)

As a user, I want an automatic summary generated at the end of each day that captures the key points from my journal entries, insights, health data, and dreams.

**Why this priority**: Summaries are essential for the AI memory feature and for users to review their days quickly. This builds on US1's chat data.

**Independent Test**: Can be tested by completing a day's journal chat, then viewing the generated summary the next day. Delivers value as a daily reflection tool.

**Acceptance Scenarios**:

1. **Given** I have journal entries for a completed day, **When** the day ends (midnight local time), **Then** an automatic summary is generated
2. **Given** a summary exists for a past day, **When** I view that day, **Then** I see both the summary and can access the original chat
3. **Given** the summary is generated, **Then** it includes sections for: general journal, insights, health status, and dreams (if present)
4. **Given** a day had no entries, **When** the day ends, **Then** no summary is generated (or a "no entries" placeholder is shown)

---

### User Story 3 - Query Historical Summaries (Priority: P3)

As a user, I want to ask the AI about my past entries and receive synthesized reports covering weeks or months of journal data.

**Why this priority**: This unlocks the long-term value of journaling by enabling pattern recognition and reflection over time. Depends on US1 and US2 being functional.

**Independent Test**: Can be tested by having several days of summaries, then asking questions like "How was my sleep last week?" or "What were my main concerns this month?". Delivers value as a personal analytics and reflection tool.

**Acceptance Scenarios**:

1. **Given** I have multiple days of summaries, **When** I ask "How was my week?", **Then** the AI provides a synthesized weekly report
2. **Given** I have a month of summaries, **When** I ask "What patterns do you see in my health?", **Then** the AI analyzes health entries across the period
3. **Given** I ask about a specific topic (e.g., "dreams about work"), **When** the AI searches my history, **Then** it finds and summarizes relevant entries
4. **Given** I ask for a report on a time range, **When** the AI responds, **Then** it cites specific dates for its conclusions

---

### User Story 4 - Navigate Past Days (Priority: P4)

As a user, I want to browse and view my past journal days, their chats, and summaries through a calendar or list interface.

**Why this priority**: Supports manual exploration of past entries, complementing the AI query feature. Lower priority as US3 covers most retrieval needs.

**Independent Test**: Can be tested by navigating to a past date and viewing its content. Delivers value as a traditional journal browser.

**Acceptance Scenarios**:

1. **Given** I want to review a past day, **When** I navigate to a calendar view, **Then** I see days with entries highlighted
2. **Given** I select a past date, **When** the day has entries, **Then** I see the summary and can expand to view the original chat
3. **Given** I select a past date, **When** I want to add to it, **Then** I can append new entries to that day's chat

---

### Edge Cases

- What happens when the user is in a different timezone than where they started the day? (System uses user's configured timezone; day boundaries follow that timezone)
- How does the system handle entries made exactly at midnight? (Entries at 00:00:00 belong to the new day)
- What happens if the user tries to edit or delete past entries? (Append-only by default; deletion requires explicit action with confirmation)
- How does the system behave with no internet connection? (Entries are stored locally; AI features queue until connectivity returns)
- What happens if summary generation fails partway through? (Retry automatically; show "summary pending" status to user)
- What happens if user forgets their password? (No recovery possible; data is permanently inaccessible; user must start fresh)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a chat interface dedicated to each calendar day
- **FR-002**: System MUST allow users to enter free-form text covering journal entries, insights, health status, and dreams
- **FR-003**: AI MUST respond conversationally to user entries, acknowledging and categorizing content types
- **FR-004**: System MUST preserve full chat history for each day
- **FR-005**: System MUST automatically generate a daily summary after each day ends (based on user's local timezone)
- **FR-006**: Daily summaries MUST be structured with sections for: general journal, insights, health observations, and dreams
- **FR-007**: System MUST store summaries in a format accessible to the AI for historical queries
- **FR-008**: Users MUST be able to query the AI about past entries using natural language
- **FR-009**: AI MUST synthesize reports covering custom time ranges (days, weeks, months)
- **FR-010**: System MUST provide navigation to view past days' chats and summaries
- **FR-011**: System MUST display a calendar or list view showing days with entries
- **FR-012**: Users MUST be able to continue adding to a past day's chat (append mode)
- **FR-013**: All journal data MUST be encrypted at rest using a key derived from user's password
- **FR-014**: AI processing via OpenRouter (GPT-4o); user provides their own API key; data sent to OpenRouter is subject to their privacy policy
- **FR-015**: System MUST require password setup on first use before any journal data can be created
- **FR-016**: System MUST require password entry to unlock and access journal data on each session
- **FR-017**: System MUST display clear warning during password setup that password cannot be recovered and forgetting it means permanent data loss

### Key Entities

- **Day**: Represents a calendar day; contains one Chat and one Summary; keyed by date and user timezone
- **Chat**: A conversation thread for a specific day; contains ordered Messages; belongs to one Day
- **Message**: A single exchange in a chat; has sender (user/AI), content, timestamp, and optional category tags (journal/insight/health/dream)
- **Summary**: AI-generated digest of a day's entries; has sections for journal, insights, health, dreams; linked to source Day
- **User**: The journal owner; has timezone preference; owns all their Days

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a journal entry conversation in under 5 minutes for typical daily logging
- **SC-002**: Daily summaries are generated within 2 minutes of day end
- **SC-003**: Historical queries return synthesized responses within 5 seconds for up to 90 days of data
- **SC-004**: Users can navigate to any past day within 3 interactions (clicks/taps)
- **SC-005**: 90% of users successfully complete their first journal entry without guidance
- **SC-006**: Summary accuracy: users agree the summary captures key points 85% of the time
- **SC-007**: Historical query relevance: users find AI responses helpful 80% of the time

## Technical Constraints

- **Platform**: Web application (browser-based, static site - no backend server)
- **Compatibility**: Desktop and mobile browsers (responsive design)
- **Data Persistence**: Local-only using IndexedDB; no server sync or cloud backup
- **Authentication**: Password-based unlock (no account required)
- **Encryption**: Journal data encrypted at rest using key derived from user password (PBKDF2 or similar)
- **Offline Support**: Journal entries always available locally; AI features require connectivity
- **Data Portability**: Manual export/import for backup (JSON format)

## Integration & External Dependencies

- **AI Provider**: OpenRouter API (https://openrouter.ai)
- **AI Model**: GPT-4o (via OpenRouter)
- **Failure Mode**: If OpenRouter is unavailable, queue user messages locally and retry; display "AI temporarily unavailable" status
- **API Key Management**: User provides their own OpenRouter API key (stored encrypted locally)

## Assumptions

- Users will primarily use the application once per day (evening reflection) with occasional mid-day check-ins
- A "day" is defined by the user's local timezone, not UTC
- The AI will use the daily summaries (not raw chat logs) for historical queries to maintain performance
- Users accept that AI responses and summaries are generated content and may require review
- The application will be single-user (personal journaling); multi-user/family features are out of scope
- Offline mode will queue entries for later sync, but AI features require connectivity
