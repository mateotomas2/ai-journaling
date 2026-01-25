# Feature Specification: AI Vector Memory for Journal Context

**Feature Branch**: `006-vector-memory`
**Created**: 2026-01-18
**Status**: Draft
**Input**: User description: "add vector memory for the AI. It should be able to query over the user's journal data and return relevant context for the conversation from any chat."

## User Scenarios & Testing *(mandatory)*

### ~~User Story 1 - AI Recalls Related Past Entries~~ (REMOVED)

> **Deprecation Notice**: This feature has been removed from the implementation. Automatic context retrieval during AI conversations is no longer supported. Users should use Manual Memory Search (User Story 2) for similar functionality with explicit user control.

**Original Intent**: Automatic retrieval of relevant past journal entries during AI conversations without user intervention.

**Reason for Removal**: Removed to simplify the user experience and give users explicit control over when and how past entries are referenced. Manual search (US2) provides similar functionality while allowing users to decide when context is needed.

**Alternative**: Use Manual Memory Search (User Story 2 below) to explicitly search for and reference past journal entries when needed.

---

### User Story 2 - Manual Memory Search (Priority: P2)

Users can explicitly search their journal history using natural language queries to find past entries. Instead of needing exact keyword matches, users can search conceptually (e.g., "times I felt proud of myself" or "conversations about my career goals").

**Why this priority**: While automatic context retrieval (P1) is essential, explicit search gives users direct control over exploring their journal history. This is secondary because users can still get value from P1 even without manual search capabilities.

**Independent Test**: Can be tested independently by implementing a search interface that accepts natural language queries and returns ranked results from the journal database. Delivers value as a standalone journal exploration tool.

**Acceptance Scenarios**:

1. **Given** a user has multiple journal entries, **When** they search for "times I made progress on my goals", **Then** the system returns entries semantically related to goal achievement, even if they don't contain those exact words
2. **Given** a user searches for a concept, **When** results are returned, **Then** they are ranked by relevance with the most contextually similar entries first
3. **Given** a user performs a search, **When** viewing results, **Then** each result includes the date, a relevant excerpt, and the conversation it came from

---

### User Story 3 - Cross-Chat Context Awareness (Priority: P3)

The AI maintains awareness of themes and patterns across all of a user's journal chats, not just the current conversation. It can identify recurring topics, track progress over time, and notice patterns the user might not see.

**Why this priority**: This builds on P1 by adding analytical capabilities across the entire journal corpus. While valuable, users can still benefit from basic context retrieval (P1) and manual search (P2) without this higher-level pattern recognition.

**Independent Test**: Can be tested by creating journal entries with recurring themes across multiple chats and verifying the AI can identify and comment on these patterns when prompted. Delivers value as an insight-generation feature.

**Acceptance Scenarios**:

1. **Given** a user has discussed "sleep problems" across 5 different chat sessions over 2 months, **When** they mention sleep issues again, **Then** the AI recognizes this as a recurring pattern and offers insights about the pattern
2. **Given** a user asks "What topics do I write about most often?", **When** the AI analyzes their journal history, **Then** it identifies and summarizes the top recurring themes across all conversations
3. **Given** a user has tracked a goal across multiple chats, **When** they ask about their progress, **Then** the AI synthesizes information from all relevant entries to show progress over time

---

### Edge Cases

- What happens when a query returns no relevant results (e.g., asking about a topic never discussed)?
- How does the system handle very large journal histories (1000+ entries)?
- What happens if a user's query is too vague or ambiguous?
- How does the system handle entries that might be relevant but from very different contexts (e.g., "stress" from work vs. personal life)?
- What happens when the user's current conversation topic gradually shifts - when should new context be retrieved?
- How does the system handle privacy/security for sensitive journal content?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST convert user journal entries into vector embeddings that capture semantic meaning
- **FR-002**: System MUST store vector embeddings in a queryable format that persists locally
- **FR-003**: System MUST perform semantic similarity search across all stored journal entries when processing user queries
- ~~**FR-004**: System MUST retrieve relevant context from past journal entries automatically during AI conversations~~ (REMOVED - automatic context retrieval feature removed)
- **FR-005**: System MUST allow users to manually search their journal history using natural language queries
- **FR-006**: System MUST return search results ranked by semantic relevance to the query
- **FR-007**: System MUST include entries from all journal chats in the searchable corpus, not just the current conversation
- **FR-008**: System MUST update the vector index when new journal entries are created
- ~~**FR-009**: System MUST retrieve the top 5 most relevant entries per query with a fixed limit to prevent overwhelming the AI with excessive context~~ (REMOVED - applies to automatic context only)
- **FR-010**: System MUST generate embeddings locally using client-side embedding models to ensure journal data never leaves the user's device
- **FR-011**: System MUST encrypt both journal entries and vector embeddings at rest using the same encryption mechanism as the existing RxDB setup

### Key Entities

- **Journal Entry**: Represents a single message or conversation turn in the user's journal. Contains the original text content, timestamp, chat session identifier, and associated metadata.
- **Vector Embedding**: Mathematical representation of a journal entry's semantic meaning as a high-dimensional vector. Each entry has a corresponding embedding used for similarity search.
- **Memory Query**: A user's request for relevant context, either explicit (manual search) or implicit (AI conversation). Contains the query text and parameters for retrieval.
- **Memory Result**: Retrieved journal entries matching a query, including the original content, relevance score, metadata (date, chat session), and contextual snippets.

### Assumptions

- **Result Limit**: A fixed limit of 5 entries per query provides sufficient context without overwhelming the AI. This balances between providing meaningful historical context and maintaining conversation coherence.
- **Privacy-First Architecture**: Local embedding generation is preferred despite potential quality/performance tradeoffs because journal content is highly sensitive personal data that should never leave the user's device.
- **Encryption Consistency**: Vector embeddings will be encrypted using the same mechanism as existing RxDB data to maintain consistent security posture across all stored data.
- **Performance Considerations**: Local embedding generation may be slower on older devices, but this is acceptable given the privacy benefits and the fact that embedding is a one-time operation per journal entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: AI responses reference relevant past journal entries in at least 80% of conversations where applicable context exists
- **SC-002**: Users can find relevant past entries through natural language search with 90% success rate for queries about topics they've actually discussed
- **SC-003**: Search results return in under 2 seconds for journal histories up to 1000 entries
- **SC-004**: Users report that AI conversations feel more continuous and contextually aware compared to conversations without memory (measured through user feedback)
- **SC-005**: The system successfully retrieves relevant context from entries up to 6 months old with the same accuracy as recent entries
- **SC-006**: At least 70% of retrieved context is rated as "relevant and helpful" by users when shown in AI responses
