# Tasks: End-to-End Encrypted Cloud Sync

**Input**: Design documents from `/specs/007-e2e-encrypted-cloud/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Tests**: Required by constitution (TDD principle II). Tests MUST be written first and fail before implementation.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization for both client and server

- [ ] T001 Install pako dependency: run `npm install pako` and `npm install -D @types/pako` in project root
- [ ] T002 Add `VITE_CLOUD_SYNC_URL` environment variable to `.env` with value `http://localhost:8787/api/v1`
- [ ] T003 Initialize server project: create `server/package.json` with typescript, vitest, wrangler dependencies and `server/tsconfig.json` with strict mode targeting ES2022/ESNext for Workers runtime
- [ ] T004 Create `server/wrangler.toml` with D1 database binding (DB), R2 bucket binding (BLOBS), and vars GOOGLE_CLIENT_ID and MAX_BLOB_SIZE=10485760 per quickstart.md
- [ ] T005 Create D1 schema in `server/schema.sql` with `user_records` table (id TEXT PRIMARY KEY, email TEXT, created_at TEXT, updated_at TEXT) and `encrypted_blobs` table (user_id TEXT PRIMARY KEY REFERENCES user_records(id), data BLOB, etag TEXT, size_bytes INTEGER, created_at TEXT, updated_at TEXT)
- [ ] T006 Create `server/vitest.config.ts` with TypeScript support for Workers environment

**Checkpoint**: Both client and server projects are initialized and ready for development

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**Warning**: No user story work can begin until this phase is complete

### Tests First

- [ ] T007 [P] Write unit tests for gzip compression helpers in `tests/unit/compression.test.ts`: test compress/decompress round-trip for JSON strings, empty strings, unicode content, and large payloads (verify size reduction)
- [ ] T008 [P] Write unit tests for cloud API client in `tests/unit/cloud-api.test.ts`: test downloadBlob (200 with etag, 404), uploadBlob (200, 409 conflict, 413 too large), deleteBlob (204), getSyncStatus (200), and 401 unauthorized handling. Mock fetch.
- [ ] T009 [P] Write unit tests for server auth in `server/tests/auth.test.ts`: test Google ID token verification with valid JWT, expired JWT, malformed JWT, and missing token. Mock Google JWKS fetch.
- [ ] T010 [P] Write unit tests for server handlers in `server/tests/handlers.test.ts`: test GET /sync (200 with blob, 404 no blob), PUT /sync (200 first upload, 200 update with matching etag, 409 stale etag, 413 too large), DELETE /sync (204), GET /sync/status (200 with blob, 200 without blob). Use miniflare or Workers test helpers.

### Server Implementation

- [ ] T011 [P] Create shared types in `server/src/types.ts`: define Env interface (DB: D1Database, BLOBS: R2Bucket, GOOGLE_CLIENT_ID: string, MAX_BLOB_SIZE: string), UploadResponse, SyncStatus, and ApiError types matching contracts/api.yaml schemas
- [ ] T012 Implement Google ID token verification in `server/src/auth.ts`: fetch Google JWKS from https://www.googleapis.com/oauth2/v3/certs, verify JWT signature and claims (iss, aud matching GOOGLE_CLIENT_ID, exp), extract sub and email. Cache JWKS with TTL. Export `authenticateRequest(request, env)` returning `{sub, email}` or throwing 401.
- [ ] T013 Implement sync handlers in `server/src/handlers/sync.ts`: GET handler reads blob from R2 by user sub, returns binary with ETag header (404 if not found). PUT handler validates If-Match etag against stored etag (409 if mismatch), computes SHA-256 etag of uploaded body, stores in R2, upserts user_record and encrypted_blob in D1, returns UploadResponse JSON. DELETE handler removes blob from R2 and encrypted_blob row from D1, returns 204.
- [ ] T014 [P] Implement status handler in `server/src/handlers/status.ts`: GET handler queries D1 for encrypted_blob by user sub, returns SyncStatus JSON with exists boolean, etag, size_bytes, updated_at
- [ ] T015 Implement Worker entry point in `server/src/index.ts`: route requests to handlers based on method+path (GET/PUT/DELETE /api/v1/sync, GET /api/v1/sync/status), add CORS headers (Access-Control-Allow-Origin, Allow-Headers including Authorization and If-Match, Allow-Methods), call authenticateRequest middleware before handlers, return 404 for unknown routes, catch errors and return ApiError JSON

### Client Implementation

- [ ] T016 [P] Implement gzip compression helpers in `src/services/crypto/compression.ts`: export `compress(data: string): Uint8Array` using pako.gzip and `decompress(data: Uint8Array): string` using pako.ungzip with `{to: 'string'}`. Handle errors with descriptive messages.
- [ ] T017 [P] Implement Google ID token management in `src/services/cloud/auth.ts`: use existing Google Identity Services (GIS) to request ID tokens (credential.id_token from google.accounts.id). Export `getCloudIdToken(): Promise<string>` that returns cached token or requests new one, `signInForCloud(): Promise<{idToken: string, email: string}>` that triggers Google sign-in popup and returns ID token + email, `signOutCloud(): void` that clears cached token, and `isCloudSignedIn(): boolean`. Store ID token and expiry in module-level variables (not localStorage, as tokens are short-lived).
- [ ] T018 Implement cloud API client in `src/services/cloud/api.ts`: export functions matching contracts/api.yaml — `downloadBlob(token): Promise<{data: string, etag: string} | null>` (returns null on 404), `uploadBlob(data: string, token: string, etag?: string): Promise<UploadResponse>` (throws CloudApiError with status on 409/413/401), `deleteBlob(token): Promise<void>`, `getSyncStatus(token): Promise<SyncStatus>`. Use `VITE_CLOUD_SYNC_URL` env var as base URL. Create `CloudApiError extends Error` with status code property.

**Checkpoint**: Foundation ready — server handles all 4 endpoints, client has compression + auth + API client. All foundational tests pass.

---

## Phase 3: User Story 1 — Enable Cloud Sync with Google Sign-In (Priority: P1) MVP

**Goal**: User can connect Google account, perform initial sync (export → compress → encrypt → upload), see sync status in Settings.

**Independent Test**: Connect a Google account in Settings, verify server receives encrypted blob, confirm local data unchanged.

### Tests First

- [ ] T019 Write unit tests for CloudSyncEngine in `tests/unit/cloud-engine.test.ts`: test constructor initializes with db and getEncryptionKey, test `sync()` method exports local data then compresses then encrypts then uploads via API client (mock all dependencies), test `sync()` downloads remote blob then decrypts then decompresses then merges when remote data exists, test error states (401 sets needs-reauth, network error sets error state, 409 triggers merge-and-retry), test `status` getter returns current SyncStatus
- [ ] T020 Write integration test for connect + initial sync in `tests/integration/cloud-sync.test.ts`: test full flow with mocked server — create test DB with sample data, run sync, verify API client called with encrypted+compressed payload, verify local data unchanged after sync

### Implementation

- [ ] T021 [US1] Implement CloudSyncEngine class in `src/services/sync/cloud-engine.ts`: mirror SyncEngine pattern from `src/services/sync/engine.ts`. Constructor takes `db: JournalDatabase` and `getEncryptionKey: () => Promise<CryptoKey>`. Implement `sync()` method: get ID token via cloud auth, get encryption key, call getSyncStatus to check for remote data, if remote exists download+decrypt+decompress+parse to SyncData then merge with local using existing merge strategies (import from services/db/export.ts and services/db/import.ts), export local data, compress with compression.ts, encrypt with encryption.ts, upload via api.ts with ETag. Track SyncState (idle/syncing/error/needs-reauth) with observer pattern (onStatusChange listener). Store etag in localStorage key `reflekt_cloud_etag`. Export `isCloudSyncEnabled()` and `setCloudSyncEnabled()` reading/writing `reflekt_cloud_enabled` and `reflekt_cloud_user_email` localStorage keys.
- [ ] T022 [US1] Implement useCloudSync React hook in `src/hooks/useCloudSync.ts`: mirror useGoogleDriveSync pattern. Return `{isConnected, isSyncing, lastSyncTime, syncError, needsReauth, syncState, userEmail, connect, disconnect, syncNow}`. `connect()` calls signInForCloud, enables sync in localStorage, creates CloudSyncEngine, runs initial sync. `disconnect()` stops engine, calls signOutCloud, clears localStorage keys. Initialize engine on mount if already enabled (same as Drive sync hook). Use useRef for engine, useEffect for lifecycle.
- [ ] T023 [US1] Create CloudSync settings UI component in `src/components/settings/CloudSync.tsx`: mirror GoogleDriveSync.tsx pattern using shadcn/ui Card. Show "Cloud Sync" header with description about zero-knowledge encrypted backup. Disconnected state: "Connect" button. Connected state: user email, sync status (syncing spinner / error alert / success check with last sync time), "Sync Now" button (disabled while syncing), "Disconnect" button. Needs-reauth state: amber banner with re-authenticate button. Use lucide-react icons, toast notifications for actions, loading states to prevent double-clicks.
- [ ] T024 [US1] Add CloudSync component to Settings page alongside existing GoogleDriveSync in the appropriate settings page file (find and update the settings page that renders GoogleDriveSync.tsx to also render CloudSync.tsx below it)

**Checkpoint**: User Story 1 complete. User can connect Google, initial sync uploads encrypted blob, status shown in Settings. MVP is functional.

---

## Phase 4: User Story 2 — Automatic Background Sync (Priority: P1)

**Goal**: After connecting, changes auto-sync to cloud on a debounced schedule. Offline changes queue and sync when connectivity restores.

**Independent Test**: Write a journal entry, wait 30s, verify server has updated blob without manual trigger.

### Tests First

- [ ] T025 [US2] Add auto-sync unit tests to `tests/unit/cloud-engine.test.ts`: test `startAutoSync()` subscribes to RxDB collections (days, messages, notes, summaries) and triggers debounced sync, test debounce resets on rapid changes (only one sync after 30s of quiet), test `stopAutoSync()` unsubscribes and clears timer, test online event listener triggers sync when transitioning from offline to online

### Implementation

- [ ] T026 [US2] Add auto-sync to CloudSyncEngine in `src/services/sync/cloud-engine.ts`: implement `startAutoSync()` that subscribes to `db.days.$`, `db.messages.$`, `db.notes.$`, `db.summaries.$` observables and calls `scheduleDebouncedSync()` on any emission. Implement `scheduleDebouncedSync()` with 30s debounce using setTimeout (clear previous timer on each call). Implement `stopAutoSync()` that unsubscribes all and clears timer. Add `window.addEventListener('online', ...)` in startAutoSync to trigger immediate sync on reconnection. Add `navigator.onLine` check in sync() to skip if offline.
- [ ] T027 [US2] Update useCloudSync hook in `src/hooks/useCloudSync.ts`: call `engine.startAutoSync()` after successful connect and initial sync. Call `engine.stopAutoSync()` in disconnect and cleanup. In useEffect initialization (when already connected), start auto-sync after initial sync completes.

**Checkpoint**: User Story 2 complete. Changes auto-sync after 30s debounce. Offline changes sync on reconnection.

---

## Phase 5: User Story 3 — Restore Data on New Device (Priority: P2)

**Goal**: On a fresh install, user connects Google and is prompted to restore existing cloud data. Data downloads, decrypts, and populates local database.

**Independent Test**: Fresh app instance, connect same Google account, verify all previously synced data is restored after entering correct password.

### Tests First

- [ ] T028 [US3] Add restore flow tests to `tests/integration/cloud-sync.test.ts`: test fresh DB + existing cloud data triggers restore prompt, test restore downloads+decrypts+decompresses+imports all data correctly, test wrong password shows error and does not corrupt local DB, test restore with no remote data (404) skips restore gracefully

### Implementation

- [ ] T029 [US3] Add restore detection to CloudSyncEngine in `src/services/sync/cloud-engine.ts`: export `checkForRemoteData(token: string): Promise<SyncStatus>` that calls getSyncStatus API. Export `restoreFromCloud(): Promise<void>` that downloads blob, base64 decodes, decrypts with key, decompresses with pako, parses JSON as SyncData, imports into local DB using existing import functions. Handle decryption failure (wrong password) with descriptive error. Do not overwrite existing local data — use merge strategy (append messages, last-write-wins for days/notes/summaries).
- [ ] T030 [US3] Update useCloudSync hook in `src/hooks/useCloudSync.ts`: after successful sign-in in `connect()`, call `checkForRemoteData()`. If remote data exists, set a `hasRemoteData` state flag. Export `hasRemoteData` and `restoreFromCloud()` from the hook. Let the UI decide whether to prompt.
- [ ] T031 [US3] Update CloudSync.tsx in `src/components/settings/CloudSync.tsx`: when `hasRemoteData` is true after connecting, show a restore prompt dialog/banner: "Existing backup found. Restore your journal data?" with "Restore" and "Skip" buttons. On restore, call hook's `restoreFromCloud()`, show progress, handle success (toast) and failure (error toast with "wrong password" hint). On skip, proceed to normal connected state.

**Checkpoint**: User Story 3 complete. Users can restore all data on a new device using Google account + password.

---

## Phase 6: User Story 4 — Multi-Device Sync (Priority: P2)

**Goal**: Two devices with same account converge to same state. ETag-based conflict detection prevents data loss. Manual sync trigger available.

**Independent Test**: Make changes on two devices offline, bring both online, verify both have merged data.

### Tests First

- [ ] T032 [US4] Add conflict resolution tests to `tests/unit/cloud-engine.test.ts`: test sync with 409 Conflict response triggers download→merge→re-upload retry, test merge correctly appends new messages and uses last-write-wins for days/notes/summaries, test manual sync trigger via `syncNow()` works when engine is idle, test ETag is sent in If-Match header on subsequent uploads (not on first upload)

### Implementation

- [ ] T033 [US4] Enhance conflict handling in CloudSyncEngine `src/services/sync/cloud-engine.ts`: in `sync()`, when uploadBlob throws 409 CloudApiError, catch it, call downloadBlob to get latest remote data, decrypt+decompress+parse, merge remote with local (using existing strategies), re-export+compress+encrypt local data, retry uploadBlob with new ETag. Limit retry to 3 attempts to prevent infinite loops. Store and send ETag from localStorage `reflekt_cloud_etag` on every PUT request.
- [ ] T034 [US4] Add manual sync to useCloudSync hook in `src/hooks/useCloudSync.ts`: ensure `syncNow()` calls `engine.sync()` directly (bypassing debounce). This should already work from US1 implementation — verify and add test if needed.

**Checkpoint**: User Story 4 complete. Multi-device sync works with automatic conflict resolution.

---

## Phase 7: User Story 5 — Coexistence with Google Drive Sync (Priority: P3)

**Goal**: Both Google Drive sync and Cloud Sync can be enabled simultaneously without interference.

**Independent Test**: Enable both sync options, make changes, verify both receive encrypted data independently.

### Tests First

- [ ] T035 [US5] Add coexistence test to `tests/integration/cloud-sync.test.ts`: test both SyncEngine (Drive) and CloudSyncEngine (Cloud) can be instantiated and run sync() without interfering — mock both backends, verify each receives its own encrypted payload independently. Test enabling/disabling one does not affect the other's localStorage keys.

### Implementation

- [ ] T036 [US5] Verify CloudSync localStorage keys (`reflekt_cloud_*`) do not conflict with Drive sync keys (`reflekt_gdrive_*`) in `src/services/sync/cloud-engine.ts` — this should already be the case by design, but audit and add a comment documenting the key namespace separation
- [ ] T037 [US5] Update Settings page to render both GoogleDriveSync and CloudSync components with clear visual separation (e.g., separate cards with distinct headers). Ensure connecting/disconnecting one does not affect the other's UI state. Verify in the settings page file.

**Checkpoint**: User Story 5 complete. Both sync options work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, edge cases, and cleanup

- [ ] T038 [P] Implement password change re-encryption in `src/services/sync/cloud-engine.ts`: export `reEncryptAndSync(newKey: CryptoKey): Promise<void>` that exports all local data, compresses, encrypts with new key, uploads to server. Integrate with the password change flow in the app (find where password change is handled and call reEncryptAndSync after deriving new key).
- [ ] T039 [P] Add exponential backoff retry to CloudSyncEngine in `src/services/sync/cloud-engine.ts`: on network error in `sync()`, retry with delays of 1s, 2s, 4s, 8s (max 4 retries) before setting error state. Reset retry count on successful sync.
- [ ] T040 [P] Add rate limit handling to cloud API client in `src/services/cloud/api.ts`: when server returns 429, read `Retry-After` header and delay before retrying. Expose rate limit status to caller.
- [ ] T041 Run `npm test && npm run lint` from project root and fix any TypeScript errors or lint issues across all new files
- [ ] T042 Run `cd server && npm test` and fix any server-side test failures
- [ ] T043 Validate quickstart.md by walking through the verification steps manually: start worker locally, start client, connect cloud sync, write entry, verify sync completes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — BLOCKS US2, US3, US4
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — adds auto-sync to existing engine
- **US3 (Phase 5)**: Depends on US1 (Phase 3) — adds restore flow to existing engine
- **US4 (Phase 6)**: Depends on US1 (Phase 3) — adds conflict handling to existing engine
- **US5 (Phase 7)**: Depends on US1 (Phase 3) — verifies coexistence
- **Polish (Phase 8)**: Depends on US1-US5 complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only. Core sync engine + UI. **This is the MVP.**
- **US2 (P1)**: Depends on US1. Adds auto-sync on top of US1's engine.
- **US3 (P2)**: Depends on US1. Can run in parallel with US2 and US4 after US1 completes.
- **US4 (P2)**: Depends on US1. Can run in parallel with US2 and US3 after US1 completes.
- **US5 (P3)**: Depends on US1. Can run in parallel with US2-US4 after US1 completes.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Foundation (server + client services) before engine logic
- Engine logic before React hooks
- React hooks before UI components
- UI components before settings page integration

### Parallel Opportunities

Within Phase 2 (Foundational):
- T007, T008, T009, T010 (all test files) can run in parallel
- T011, T016, T017 (types, compression, auth) can run in parallel
- T013, T014 (sync handlers, status handler) can run in parallel after T011, T012

After US1 (Phase 3) completes:
- US2 (Phase 4), US3 (Phase 5), US4 (Phase 6), US5 (Phase 7) can all start in parallel

Within Phase 8 (Polish):
- T038, T039, T040 can run in parallel (different files/concerns)

---

## Parallel Example: Phase 2 (Foundational)

```
# Round 1 — All test files (different files, no deps):
T007: compression.test.ts
T008: cloud-api.test.ts
T009: server/tests/auth.test.ts
T010: server/tests/handlers.test.ts

# Round 2 — Server types + client services (different files):
T011: server/src/types.ts
T016: src/services/crypto/compression.ts
T017: src/services/cloud/auth.ts

# Round 3 — Server auth + client API (different projects):
T012: server/src/auth.ts
T018: src/services/cloud/api.ts

# Round 4 — Server handlers (depend on T011, T012):
T013: server/src/handlers/sync.ts
T014: server/src/handlers/status.ts

# Round 5 — Server entry point (depends on T012-T014):
T015: server/src/index.ts
```

## Parallel Example: After US1 Completes

```
# These can all start simultaneously:
Phase 4 (US2): T025 → T026 → T027
Phase 5 (US3): T028 → T029 → T030 → T031
Phase 6 (US4): T032 → T033 → T034
Phase 7 (US5): T035 → T036 → T037
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T018) — server + client infrastructure
3. Complete Phase 3: User Story 1 (T019-T024) — connect + initial sync + UI
4. **STOP and VALIDATE**: Test US1 independently — connect, sync, check server has blob
5. Deploy server with `wrangler deploy`. MVP is live.

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 → connect + initial sync → **Deploy (MVP!)**
3. US2 → auto-sync → Deploy (background sync live)
4. US3 + US4 (parallel) → restore + multi-device → Deploy (full sync)
5. US5 → coexistence verified → Deploy (feature complete)
6. Polish → hardening → Deploy (production ready)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same round
- [Story] label maps task to specific user story for traceability
- Constitution requires TDD — write tests first, verify they fail, then implement
- Existing SyncEngine (Google Drive) must NOT be modified
- All new localStorage keys use `reflekt_cloud_*` prefix (not `reflekt_gdrive_*`)
- Server stores zero bytes of plaintext — verify with `wrangler r2 object get` at each checkpoint
- Commit after each task or logical group
