# Research: End-to-End Encrypted Cloud Sync

**Feature Branch**: `007-e2e-encrypted-cloud`
**Date**: 2026-02-10

## Research Topics

### R1: Cloud Sync Server Architecture (Zero-Knowledge Backend)

**Decision**: Simple REST API server that stores a single encrypted blob per user, authenticated via Google OAuth ID tokens.

**Rationale**: The existing Google Drive sync already follows a single-blob-per-user pattern with the `reflekt-sync.enc` file. Reusing this approach for the custom backend means the client-side sync logic (export → encrypt → upload, download → decrypt → merge) is nearly identical. A custom server gives full control over availability, rate limiting, and storage, without depending on Google Drive quotas or API changes.

**Alternatives Considered**:
- **Per-entity granular storage** (one blob per day/message/note): More efficient for incremental sync but adds significant complexity — versioning, conflict detection at entity level, and server-side metadata. Rejected per YAGNI.
- **CouchDB/PouchDB sync protocol**: Native RxDB sync support, but requires server to understand document structure (violates zero-knowledge) and adds heavyweight server dependency.
- **S3-compatible storage (R2, MinIO)**: Simpler server, but still needs auth layer and adds infrastructure complexity. Could be a future optimization if blob sizes grow.

---

### R2: Server Authentication — Google OAuth ID Tokens vs Access Tokens

**Decision**: Use Google OAuth ID tokens (JWT) for server authentication. The client sends the Google ID token in the Authorization header; the server verifies it with Google's public keys and extracts the user's email/sub as the identity.

**Rationale**: The app already uses Google Identity Services (GIS) for Drive OAuth. GIS provides both access tokens (for Drive API) and ID tokens (for backend auth). Using ID tokens is the standard approach for authenticating to your own backend — they're JWTs that the server can verify without calling Google's API on every request. This avoids sharing Drive access tokens with the custom server.

**Alternatives Considered**:
- **Pass Google access token to server, server validates via Google userinfo endpoint**: Requires server to call Google API on every request (slower, fragile). Access tokens are opaque — can't be verified locally.
- **Custom email/password auth on server**: Adds another credential for users to manage. Unnecessary when Google identity is already available.
- **Firebase Auth**: Adds Firebase dependency. The server is intentionally minimal.

---

### R3: Server-Side Conflict Handling

**Decision**: Optimistic concurrency using ETags. The server stores a version tag (hash of the blob) with each user's data. On upload, the client sends `If-Match: <etag>`. If the server's current etag differs, it returns 409 Conflict. The client then downloads the latest, merges, and retries.

**Rationale**: With multi-device sync, two devices could upload simultaneously. Without conflict detection, one device's data silently overwrites the other. ETags are a standard HTTP mechanism that prevents this. The merge logic already exists in the SyncEngine.

**Alternatives Considered**:
- **Last-write-wins at server level**: Simple but can silently lose data from the other device. Unacceptable for journal data.
- **Server-side merge**: Violates zero-knowledge — server would need to decrypt to merge.
- **Operational transforms / CRDTs**: Massive complexity. The existing merge strategies (append-only messages, last-write-wins timestamps) are sufficient.

---

### R4: Encryption Key Relationship — Local DB vs Cloud Sync

**Decision**: Reuse the same password-derived key for cloud sync encryption, exactly as the existing Google Drive sync does. The key is derived via PBKDF2 from the user's password and converted to a CryptoKey via `getSyncEncryptionKey()`.

**Rationale**: The existing `getSyncEncryptionKey()` function already provides this. Using the same key means the cloud sync feature requires zero changes to the encryption infrastructure.

**Alternatives Considered**:
- **Separate encryption key for cloud sync**: Adds key management complexity. Users would need to remember/store an additional secret. No security benefit since the local DB and cloud data contain the same content.
- **Server-derived key wrapping**: Violates zero-knowledge — server would participate in key management.

---

### R5: Client-Side Sync Engine — New Engine vs Extending Existing

**Decision**: Create a new `CloudSyncEngine` class that mirrors the `SyncEngine` pattern but targets the custom backend API instead of Google Drive. Both engines share the same export/merge/import pipeline.

**Rationale**: The existing `SyncEngine` is tightly coupled to Google Drive API calls (`findSyncFile`, `uploadSyncFile`, `downloadSyncFile`). Extracting a common base class would require refactoring the existing working code (risk of regression) for an abstraction with only two consumers. Per YAGNI, a parallel implementation that reuses the data export/merge/import functions is simpler and safer.

**Alternatives Considered**:
- **Abstract base class `BaseSyncEngine` with Drive and Cloud subclasses**: Cleaner architecture but requires refactoring tested code. Only two concrete implementations — not enough to justify the abstraction per constitution principle III.
- **Strategy pattern on existing SyncEngine**: Would make the existing engine more complex and harder to test.

---

### R6: Server Technology and Hosting

**Decision**: Cloudflare Workers with D1 (SQLite) for metadata and R2 for blob storage. Minimal serverless architecture.

**Rationale**: Cloudflare Workers provides:
- Global edge deployment (low latency worldwide)
- D1 for lightweight metadata (user records, ETags, timestamps)
- R2 for blob storage (S3-compatible, no egress fees)
- Built-in HTTPS, no infrastructure management
- Free tier covers small-scale usage
- Google ID token verification is straightforward with standard JWT libraries

**Alternatives Considered**:
- **Self-hosted Node.js/Express**: Requires server management, uptime monitoring, SSL certificates. More control but more maintenance.
- **AWS Lambda + DynamoDB + S3**: Enterprise-grade but more complex setup and potential costs. Overkill for encrypted blob storage.
- **Supabase**: Excellent developer experience but adds a dependency and the server would technically have access to the database (even if data is encrypted, it adds trust surface).
- **Fly.io with SQLite**: Good option but requires container management. Workers is simpler for this use case.

---

### R7: Data Compression Before Encryption

**Decision**: Compress JSON data with pako (gzip) before encryption. Decompress after decryption on download.

**Rationale**: Journal data is highly repetitive JSON (field names, UUIDs, date patterns). Typical compression ratios of 5-10x are achievable. This reduces upload/download time and storage costs. Compression must happen before encryption because encrypted data is incompressible (appears random).

**Alternatives Considered**:
- **No compression**: Simpler but wastes bandwidth and storage. A year of daily journaling could produce several MB of JSON.
- **Brotli compression**: Better ratios than gzip but slower compression. Gzip via pako is well-tested in browsers and sufficient.

---

### R8: Offline Queue and Retry Strategy

**Decision**: Reuse the existing debounce pattern from SyncEngine. When offline, the debounce timer simply doesn't fire a successful sync — the next online event re-triggers. Add navigator.onLine checks and `online` event listener to trigger sync when connectivity resumes.

**Rationale**: The existing SyncEngine handles offline gracefully by catching network errors and setting error state. Adding an explicit online/offline listener ensures sync resumes promptly without waiting for the next debounce trigger.

**Alternatives Considered**:
- **Persistent offline queue in IndexedDB**: Adds complexity for storing pending operations. Unnecessary since the entire state is synced as a single blob — any local change triggers a full re-sync.
- **Service Worker background sync**: Browser support is inconsistent and the API is designed for simple one-shot requests, not complex merge operations.

---

### R9: Password Change Re-encryption Flow

**Decision**: When the user changes their password, the cloud sync engine detects the key change and performs a full re-encrypt and re-upload. The engine exposes a `reEncryptAndSync()` method that the password change flow calls after deriving the new key.

**Rationale**: Since the entire journal is synced as a single encrypted blob, re-encryption is straightforward: export all data, encrypt with new key, upload. This must happen before the old key is discarded.

**Alternatives Considered**:
- **Store key-encrypted-key on server**: Would allow password change without re-uploading data, but adds complexity and a non-zero-knowledge element.
- **Ignore — require users to disconnect and reconnect sync**: Poor UX and could lead to data loss if users forget to reconnect.

---

### R10: New Dependency — pako for Compression

**Decision**: Add `pako` (^2.1) as a production dependency for gzip compression.

**Rationale**: pako is the most widely used JavaScript gzip library (300M+ weekly npm downloads), has zero dependencies, and is well-maintained. The alternative (using native CompressionStream API) has inconsistent browser support and a streaming API that's awkward for single-blob compression.

**Alternatives Considered**:
- **CompressionStream API**: Native but not universally supported (no Safari < 16.4). Would need a polyfill anyway.
- **fflate**: Faster than pako for large data, but less widely adopted and less tested. pako is sufficient for the data sizes involved.
