# Quickstart: End-to-End Encrypted Cloud Sync

**Feature Branch**: `007-e2e-encrypted-cloud`

## Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account (for Workers deployment)
- Google Cloud Console project (existing - same as Drive sync)
- Wrangler CLI (`npm install -g wrangler`)

## Client Setup

### Install new dependency

```bash
npm install pako
npm install -D @types/pako
```

### Environment variables

Add to `.env` (or `.env.local`):

```
# Development (local worker)
VITE_CLOUD_SYNC_URL=http://localhost:8787/api/v1

# Production
# VITE_CLOUD_SYNC_URL=https://sync.reflekt.app/api/v1
```

### Run development

```bash
npm run dev        # Start Vite dev server
npm test           # Run all tests
npm run lint       # Lint check
```

### Run specific tests

```bash
npm test -- --run tests/unit/cloud-engine.test.ts
npm test -- --run tests/unit/cloud-api.test.ts
npm test -- --run tests/unit/compression.test.ts
npm test -- --run tests/integration/cloud-sync.test.ts
```

## Server Setup

### Initialize project

```bash
cd server
npm install
```

### Create Cloudflare resources

```bash
# Create D1 database
wrangler d1 create reflekt-sync
# Copy the database_id from output into wrangler.toml

# Create R2 bucket
wrangler r2 bucket create reflekt-sync-blobs
```

### Initialize D1 schema

```bash
wrangler d1 execute reflekt-sync --local --file=schema.sql
```

### Configure wrangler.toml

```toml
name = "reflekt-sync"
main = "src/index.ts"
compatibility_date = "2026-02-01"

[vars]
GOOGLE_CLIENT_ID = "your-google-client-id.apps.googleusercontent.com"
MAX_BLOB_SIZE = "10485760"

[[d1_databases]]
binding = "DB"
database_name = "reflekt-sync"
database_id = "your-database-id"

[[r2_buckets]]
binding = "BLOBS"
bucket_name = "reflekt-sync-blobs"
```

### Run local development

```bash
wrangler dev       # Starts local worker on port 8787
```

### Run server tests

```bash
npm test
```

### Deploy to production

```bash
# Initialize remote D1 schema
wrangler d1 execute reflekt-sync --remote --file=schema.sql

# Deploy worker
wrangler deploy
```

## Google OAuth Setup

The existing Google Cloud Console project needs minimal changes:

1. Go to **APIs & Services > Credentials**
2. Edit the existing OAuth 2.0 Client ID
3. No additional scopes needed (ID tokens included by default with GIS)
4. Add the server URL to **Authorized JavaScript origins** (for CORS):
   - `http://localhost:8787` (development)
   - `https://sync.reflekt.app` (production)

## Verification

### Test client-server integration

1. Start the worker locally: `cd server && wrangler dev`
2. Start the client: `npm run dev`
3. Navigate to Settings
4. Click "Connect" under Cloud Sync
5. Authenticate with Google
6. Verify sync status shows "Connected"
7. Write a journal entry
8. Wait for debounce (30s) or click "Sync Now"
9. Verify sync status shows last sync time

### Verify zero-knowledge

```bash
# Check what's stored in R2 (should be opaque binary)
wrangler r2 object get reflekt-sync-blobs/<user-sub>

# Check D1 metadata (should only have user ID, email, timestamps)
wrangler d1 execute reflekt-sync --local --command="SELECT * FROM user_records"
```
