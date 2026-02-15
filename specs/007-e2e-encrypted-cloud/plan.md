# Implementation Plan: End-to-End Encrypted Cloud Sync

**Branch**: `007-e2e-encrypted-cloud` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-e2e-encrypted-cloud/spec.md`

## Summary

Implement a zero-knowledge encrypted cloud sync backend and client integration. The server (Cloudflare Workers + D1 + R2) stores only opaque encrypted blobs per user, authenticated via Google OAuth ID tokens. The client encrypts all data with the existing password-derived AES-GCM key, compresses with gzip (pako), and uses ETags for optimistic concurrency. This coexists alongside the existing Google Drive sync.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode) - React 19.2 + Vite 7.3 PWA (client), Cloudflare Workers (server)
**Primary Dependencies**: Client: RxDB 16.21, pako (gzip), existing crypto services. Server: Workers runtime, D1 (SQLite), R2 (blob storage)
**Storage**: Client: IndexedDB (RxDB/Dexie, encrypted). Server: D1 for user metadata, R2 for encrypted blobs
**Testing**: Vitest 4.0 (unit/integration), Playwright (e2e)
**Target Platform**: Web (PWA) + Cloudflare edge network
**Project Type**: Web application (frontend + serverless backend)
**Performance Goals**: Sync within 60s of last change. Initial upload < 2 min. Restore < 3 min
**Constraints**: Offline-capable, zero-knowledge server, < 10 MB blob limit
**Scale/Scope**: Single-user per device, multi-device per account

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Privacy-First - PASS

- All journal data encrypted client-side (AES-GCM) before transmission
- Server stores only opaque encrypted blobs - zero-knowledge architecture
- Cloud sync is opt-in only (user must explicitly connect)
- Encryption key derived from user password, never leaves the device
- Google OAuth used only for identity, not for accessing user data

### II. Test-Driven Development - PASS

- TDD methodology for all new code
- Unit tests for CloudSyncEngine, API client, compression helpers
- Integration tests for full sync flow (encrypt, upload, download, decrypt, merge)
- Critical path coverage > 90%

### III. Simplicity (YAGNI) - PASS

- Single encrypted blob per user (matches existing Google Drive approach)
- Parallel CloudSyncEngine mirrors existing SyncEngine (no premature abstraction)
- Reuses existing export/merge/import pipeline
- Server is minimal REST API (4 endpoints)
- pako is the only new client dependency

### IV. UI Framework - PASS

- CloudSync settings component uses shadcn/ui Card pattern (matching GoogleDriveSync)
- Tailwind CSS utility classes, Lucide React icons

### Post-Design Re-check - PASS

No violations detected.

## Project Structure

### Documentation (this feature)

```text
specs/007-e2e-encrypted-cloud/
+-- plan.md              # This file
+-- research.md          # Phase 0: Research decisions
+-- data-model.md        # Phase 1: Data model
+-- api-contract.md      # Phase 1: REST API contract
+-- quickstart.md        # Phase 1: Dev setup guide
+-- tasks.md             # Phase 2: Implementation tasks
```

### Source Code (repository root)

```text
src/
+-- components/settings/
|   +-- CloudSync.tsx              # NEW: Cloud sync settings UI
+-- hooks/
|   +-- useCloudSync.ts            # NEW: React hook for sync lifecycle
+-- services/
|   +-- sync/
|   |   +-- engine.ts              # EXISTING: Google Drive sync
|   |   +-- cloud-engine.ts        # NEW: Cloud sync engine
|   +-- cloud/
|   |   +-- api.ts                 # NEW: Cloud sync API client
|   |   +-- auth.ts                # NEW: Google ID token management
|   +-- crypto/
|       +-- encryption.ts          # EXISTING: AES-GCM helpers
|       +-- compression.ts         # NEW: gzip helpers

server/                             # NEW: Cloudflare Workers backend
+-- src/
|   +-- index.ts                   # Worker entry + routing
|   +-- auth.ts                    # Google ID token verification
|   +-- handlers/
|   |   +-- sync.ts                # GET/PUT/DELETE /sync
|   |   +-- status.ts             # GET /sync/status
|   +-- types.ts
+-- schema.sql                     # D1 user_records table
+-- wrangler.toml
+-- tsconfig.json
+-- vitest.config.ts
+-- package.json

tests/
+-- unit/
|   +-- cloud-engine.test.ts       # NEW
|   +-- cloud-api.test.ts          # NEW
|   +-- compression.test.ts        # NEW
+-- integration/
    +-- cloud-sync.test.ts         # NEW

server/tests/
+-- auth.test.ts
+-- handlers.test.ts
```

**Structure Decision**: Frontend (existing src/) + serverless backend (new server/). Server is a separate Cloudflare Workers project with its own package.json because it runs in a different runtime.

## API Contract

4 REST endpoints, all authenticated with Google ID token (JWT) in Bearer header:

- **GET /sync** - Download encrypted blob. Returns binary with ETag header. 404 if none.
- **PUT /sync** - Upload encrypted blob. If-Match header for optimistic concurrency. 409 on conflict (client must GET, merge, retry).
- **DELETE /sync** - Delete blob. Returns 204.
- **GET /sync/status** - Metadata only: exists, etag, size_bytes, updated_at.

Concurrency: ETags (SHA-256 of blob). PUT with stale ETag returns 409.

## Key Decisions (from research.md)

1. Single encrypted blob per user (matches Google Drive approach)
2. Google ID tokens for server auth (not access tokens)
3. ETags for optimistic concurrency (prevents silent overwrites)
4. Same password-derived key for cloud encryption (via getSyncEncryptionKey)
5. Parallel CloudSyncEngine class (no refactoring of existing SyncEngine)
6. Cloudflare Workers + D1 + R2 for server infrastructure
7. pako gzip compression before encryption (5-10x size reduction)
8. Online/offline event listeners for connectivity-aware sync
9. Full re-encrypt and re-upload on password change
10. pako as only new client dependency

## Quickstart

### Client Development

```bash
npm install pako && npm install -D @types/pako
npm run dev        # Start dev server
npm test           # Run tests
```

### Server Development

```bash
cd server && npm install
wrangler d1 create reflekt-sync
wrangler r2 bucket create reflekt-sync-blobs
wrangler dev       # Local dev server
npm test           # Run server tests
wrangler deploy    # Deploy to production
```

### Environment Variables

Client `.env`: `VITE_CLOUD_SYNC_URL=http://localhost:8787/api/v1`
Server `wrangler.toml`: `GOOGLE_CLIENT_ID`, `MAX_BLOB_SIZE=10485760`

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Separate server/ project | Workers runtime differs from browser runtime | Cannot mix runtimes in single tsconfig/build |
