# Feature Specification: End-to-End Encrypted Cloud Sync

**Feature Branch**: `007-e2e-encrypted-cloud`
**Created**: 2026-02-10
**Status**: Draft
**Input**: User description: "End-to-end encrypted cloud sync with zero-knowledge server backend. The server stores only encrypted blobs and has no ability to read user data. Coexists with Google Drive sync. Server authentication uses Google OAuth."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable Cloud Sync with Google Sign-In (Priority: P1)

A user wants to back up their journal data to a secure cloud server so they can recover it if they lose their device. They navigate to Settings, find the "Cloud Sync" section alongside the existing Google Drive option, and click "Connect". They authenticate with their Google account. The system confirms their connection and begins an initial sync, uploading all their journal data as encrypted blobs to the server. The server never has access to their encryption key or plaintext data.

**Why this priority**: This is the core value proposition. Without the ability to connect and perform an initial sync, no other cloud sync functionality works.

**Independent Test**: Can be fully tested by connecting a Google account, verifying the server receives only encrypted data, and confirming the local data remains accessible and unchanged after sync.

**Acceptance Scenarios**:

1. **Given** a user is on the Settings page and has not yet enabled cloud sync, **When** they click "Connect" under Cloud Sync and authenticate with Google, **Then** the system establishes a connection and displays a "Connected" status with the user's Google email.
2. **Given** a user has just connected cloud sync, **When** the initial sync begins, **Then** all local journal data is encrypted client-side and uploaded to the server as opaque blobs.
3. **Given** a user has cloud sync connected, **When** they view the Settings page, **Then** they see their sync status, last sync time, and an option to disconnect.

---

### User Story 2 - Automatic Background Sync (Priority: P1)

A user writes journal entries throughout the day. As they write, the app automatically syncs changes to the cloud server in the background without requiring manual action. The sync happens on a debounced schedule (not on every keystroke) and shows a subtle indicator when syncing is in progress.

**Why this priority**: Automatic sync is essential for the core value of cloud backup — users should not have to remember to manually sync.

**Independent Test**: Can be tested by writing a journal entry and verifying that the encrypted data appears on the server within the debounce window without any manual trigger.

**Acceptance Scenarios**:

1. **Given** a user has cloud sync enabled and writes a new journal entry, **When** the debounce period elapses after the last change, **Then** the system automatically encrypts and uploads the updated data.
2. **Given** a sync is in progress, **When** the user views the app, **Then** a subtle sync indicator is visible.
3. **Given** the user is offline, **When** they make changes, **Then** changes are queued and synced automatically when connectivity is restored.

---

### User Story 3 - Restore Data on New Device (Priority: P2)

A user sets up the app on a new device (or reinstalls). After creating their local password and signing in with Google for cloud sync, the system detects existing cloud data and offers to restore it. The user confirms, the encrypted blobs are downloaded and decrypted locally using their password-derived key, and all their journal entries, notes, and summaries are restored.

**Why this priority**: Data recovery is the primary reason users want cloud sync. Without restore capability, the backup is useless.

**Independent Test**: Can be tested by setting up a fresh app instance, connecting with the same Google account, and verifying all previously synced data is restored after entering the correct password.

**Acceptance Scenarios**:

1. **Given** a user installs the app on a new device and connects cloud sync with an existing Google account, **When** the system detects existing cloud data, **Then** the user is prompted to restore from cloud backup.
2. **Given** the user confirms restore, **When** the encrypted data is downloaded, **Then** it is decrypted using the user's password-derived key and all entries are restored to the local database.
3. **Given** the user enters an incorrect password during restore, **When** decryption is attempted, **Then** the system displays a clear error that the password does not match and does not corrupt the local database.

---

### User Story 4 - Multi-Device Sync (Priority: P2)

A user has the app open on two devices (e.g., phone and laptop). When they write an entry on one device, the other device picks up the changes on its next sync cycle. Conflicts are resolved using the existing merge strategy (append-only for messages, last-write-wins for days and notes).

**Why this priority**: Multi-device is a natural extension of cloud sync and a key user expectation, but requires the core sync to be working first.

**Independent Test**: Can be tested by making changes on two devices and verifying both devices converge to the same state after sync completes on both.

**Acceptance Scenarios**:

1. **Given** a user has cloud sync active on two devices, **When** they add a journal entry on Device A, **Then** Device B receives the new entry on its next sync cycle.
2. **Given** both devices have made changes while offline, **When** both come online and sync, **Then** messages are merged (append-only), and days/notes use last-write-wins based on timestamps.
3. **Given** a user triggers a manual sync on a device, **When** there are pending remote changes, **Then** the device downloads and merges those changes immediately.

---

### User Story 5 - Coexistence with Google Drive Sync (Priority: P3)

A user who already uses Google Drive sync wants to also enable the new cloud sync as a secondary backup, or switch from one to the other. Both sync options appear in Settings and can be enabled independently. Enabling one does not disable the other.

**Why this priority**: Coexistence ensures backward compatibility and gives users flexibility. It's important but not blocking for core functionality.

**Independent Test**: Can be tested by enabling both sync options simultaneously and verifying both receive encrypted data without conflicts.

**Acceptance Scenarios**:

1. **Given** a user has Google Drive sync enabled, **When** they also enable cloud sync, **Then** both sync independently without interfering with each other.
2. **Given** a user has only cloud sync enabled, **When** they make changes, **Then** data is synced only to the cloud server (not to Google Drive).
3. **Given** a user disables cloud sync but keeps Google Drive sync, **When** they make changes, **Then** only Google Drive sync continues to function.

---

### Edge Cases

- What happens when the server is unreachable during sync? The system retries with exponential backoff and queues changes for later upload.
- What happens when the user changes their local password? The encryption key changes, so all data must be re-encrypted and re-uploaded. The system handles this migration transparently.
- What happens when the Google OAuth token expires during sync? The system refreshes the token automatically. If refresh fails, the user is prompted to re-authenticate.
- What happens when the user's cloud storage exceeds server limits? The system informs the user and stops syncing until storage is freed or the limit is increased.
- What happens when a sync is interrupted mid-upload? The system resumes from the last successful state on the next sync attempt. Partial uploads are discarded server-side.
- What happens when two devices sync simultaneously and conflict? The server accepts the first upload and the second device detects the conflict on download, merging using existing strategies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to enable cloud sync from the Settings page, separate from the existing Google Drive sync option.
- **FR-002**: System MUST authenticate users to the cloud server using Google OAuth, reusing the Google identity already available in the app.
- **FR-003**: System MUST encrypt all journal data client-side before uploading to the server, using the existing password-derived encryption key (AES-GCM with PBKDF2).
- **FR-004**: The server MUST store only opaque encrypted blobs — it MUST NOT have access to encryption keys or plaintext data at any point.
- **FR-005**: System MUST automatically sync changes to the server after a configurable debounce period (default: 30 seconds) following the last local change.
- **FR-006**: System MUST support downloading encrypted data from the server and decrypting it locally for data restore on new devices.
- **FR-007**: System MUST merge remote and local data using existing conflict resolution strategies: append-only for messages, last-write-wins (by timestamp) for days, notes, and summaries.
- **FR-008**: System MUST allow both Google Drive sync and cloud sync to be enabled simultaneously without interference.
- **FR-009**: System MUST display sync status to the user: connected/disconnected, syncing in progress, last successful sync time, and any errors.
- **FR-010**: System MUST handle network failures gracefully with automatic retry using exponential backoff.
- **FR-011**: System MUST handle Google OAuth token expiration by attempting automatic refresh, falling back to prompting the user to re-authenticate.
- **FR-012**: System MUST provide a manual sync trigger in addition to automatic sync.
- **FR-013**: System MUST allow users to disconnect cloud sync from Settings, which stops syncing but does not delete server-side data.
- **FR-014**: System MUST NOT sync embeddings (vector data) — these are large and can be regenerated locally.
- **FR-015**: System MUST handle password changes by re-encrypting and re-uploading all data with the new encryption key.

### Key Entities

- **Cloud Sync Connection**: Represents the user's active connection to the cloud server. Attributes: Google user identity, authentication token, connection status, last sync timestamp.
- **Encrypted Blob**: An opaque encrypted payload stored on the server. Contains all synced journal data (days, messages, notes, summaries) encrypted with the user's password-derived key. The server cannot inspect its contents.
- **Sync State**: Local tracking of synchronization progress. Attributes: last successful sync time, pending changes flag, sync-in-progress flag, error state.

## Assumptions

- The cloud server will be a simple storage backend with authentication — it does not need to understand or process journal data.
- Google OAuth is used only for identity verification on the server; the encryption key remains entirely local and password-derived.
- The existing sync data format (`SyncData` with version, days, messages, summaries, notes) will be reused for the cloud sync payload.
- The server does not need to support granular per-entry storage — a single encrypted blob per user is sufficient (matching the existing Google Drive approach).
- Rate limiting and storage quotas will be enforced server-side but are outside the scope of this client-side specification.
- The server backend implementation (hosting, infrastructure, deployment) is a separate concern from this feature specification, which focuses on the client-side integration and protocol.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can enable cloud sync and complete initial upload within 2 minutes for a typical journal (up to 1 year of daily entries).
- **SC-002**: Automatic sync completes within 60 seconds of the last change under normal network conditions.
- **SC-003**: Data restore on a new device completes within 3 minutes for a typical journal size.
- **SC-004**: Users can operate both Google Drive sync and cloud sync simultaneously without data loss or sync conflicts between the two systems.
- **SC-005**: The server stores zero bytes of plaintext user data — all stored data is encrypted and indistinguishable from random bytes without the user's password.
- **SC-006**: Sync recovers automatically from network interruptions without user intervention in 95% of cases.
- **SC-007**: Users can successfully restore their complete journal data on a new device using only their Google account and local password.
