# Data Model: End-to-End Encrypted Cloud Sync

**Feature Branch**: `007-e2e-encrypted-cloud`
**Date**: 2026-02-10

## Overview

This feature introduces server-side data storage and extends the client with new sync state tracking. The server operates in zero-knowledge mode — it stores only opaque encrypted blobs and authentication metadata.

## Server-Side Entities

### UserRecord

Represents an authenticated user on the server. Created on first sync.

| Field       | Type      | Description                                          |
|-------------|-----------|------------------------------------------------------|
| id          | string    | Primary key. Google `sub` claim from ID token (stable user identifier) |
| email       | string    | Google email (for display/logging only, not used for auth) |
| created_at  | timestamp | When the user first connected                        |
| updated_at  | timestamp | Last successful upload timestamp                     |

**Constraints**:
- `id` is immutable after creation
- `email` may change (Google allows email changes) — updated on each auth

### EncryptedBlob

The opaque encrypted journal data. One per user.

| Field       | Type      | Description                                          |
|-------------|-----------|------------------------------------------------------|
| user_id     | string    | Foreign key → UserRecord.id                          |
| data        | binary    | Encrypted + compressed journal data (opaque to server) |
| etag        | string    | SHA-256 hash of `data`, used for optimistic concurrency |
| size_bytes  | integer   | Size of `data` in bytes (for quota enforcement)      |
| created_at  | timestamp | When the blob was first created                      |
| updated_at  | timestamp | Last upload timestamp                                |

**Constraints**:
- One blob per user (1:1 relationship with UserRecord)
- `etag` is recomputed on every upload
- `size_bytes` is computed server-side from the uploaded data
- Server MUST NOT inspect or decrypt `data`

### Relationships

```
UserRecord 1 ──── 1 EncryptedBlob
```

Each user has exactly zero or one encrypted blob. The blob is created on first sync and updated on subsequent syncs. There is no blob versioning — each upload replaces the previous.

## Client-Side Entities (New/Modified)

### CloudSyncState (New — localStorage)

Tracks the client's cloud sync connection and status. Stored in localStorage (not in RxDB) to match the existing Google Drive sync pattern.

| Key                          | Type    | Description                                     |
|------------------------------|---------|--------------------------------------------------|
| `reflekt_cloud_enabled`      | string  | "true" if cloud sync is enabled                 |
| `reflekt_cloud_last_sync`    | string  | ISO 8601 timestamp of last successful sync      |
| `reflekt_cloud_etag`         | string  | Last known ETag from server (for conflict detection) |
| `reflekt_cloud_user_email`   | string  | Google email of connected user (for display)    |

**Rationale**: Using localStorage mirrors the existing `reflekt_gdrive_*` keys pattern. These are sync metadata, not journal data, so they don't need RxDB encryption.

### Existing Entities (Unchanged)

The following entities are unchanged but are included in the sync payload:

- **Day**: Synced. Merge strategy: last-write-wins by `updatedAt`
- **Message**: Synced. Merge strategy: append-only (insert if ID not present)
- **Note**: Synced. Merge strategy: last-write-wins by `updatedAt`
- **Summary**: Synced. Merge strategy: last-write-wins by `generatedAt`
- **Embedding**: NOT synced (too large, regenerated locally)
- **Settings**: NOT synced (local configuration, contains API keys)

## Sync Data Format

The encrypted blob contains a JSON payload matching the existing `SyncData` interface:

```
SyncData {
  version: "1.0.0"
  syncedAt: ISO 8601 timestamp
  days: Day[]
  messages: Message[]
  summaries: Summary[]
  notes: Note[]
}
```

### Data Pipeline

```
Export (client)
  → JSON.stringify(SyncData)
  → pako.gzip(jsonString)        // Compress
  → encrypt(compressed, key)     // AES-GCM with random IV
  → base64(iv + ciphertext)      // Encode for transport
  → HTTP PUT to server

Download (client)
  → HTTP GET from server
  → base64 decode
  → decrypt(ciphertext, key)     // AES-GCM
  → pako.ungzip(decrypted)       // Decompress
  → JSON.parse(jsonString)       // → SyncData
  → Merge with local data
```

## State Transitions

### Sync Connection States

```
Disconnected → Connecting → Connected → Syncing → Connected
                   ↓                       ↓
                 Error                   Error
                   ↓                       ↓
              Disconnected          NeedsReauth / Connected (retry)
```

### Sync Operation States

```
Idle
  ↓ (local change detected, debounce timer starts)
Pending
  ↓ (debounce timer fires)
Syncing
  ├── ↓ (success) → Idle
  ├── ↓ (409 Conflict) → Download → Merge → Re-upload → Idle
  ├── ↓ (401 Unauthorized) → NeedsReauth
  └── ↓ (network error) → Error → Retry with backoff → Syncing
```
