# Security Audit Report — AI Journal (Reflekt)

**Classification:** Confidential
**Date:** 2026-02-15
**Auditor:** Security Engineering Consultancy
**Application Version:** Current `master` (commit `dd6df54`)
**Scope:** Full client-side PWA + Cloudflare Worker auth proxy
**Risk Rating Methodology:** CVSS v3.1 qualitative (Critical / High / Medium / Low / Informational)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Threat Model](#3-threat-model)
4. [Findings — Critical](#4-findings--critical)
5. [Findings — High](#5-findings--high)
6. [Findings — Medium](#6-findings--medium)
7. [Findings — Low](#7-findings--low)
8. [Findings — Informational](#8-findings--informational)
9. [Device Compromise Scenarios](#9-device-compromise-scenarios)
10. [Sync & Cloud Security Analysis](#10-sync--cloud-security-analysis)
11. [Biometric Authentication Analysis](#11-biometric-authentication-analysis)
12. [Token & Key Management Analysis](#12-token--key-management-analysis)
13. [Cryptographic Implementation Review](#13-cryptographic-implementation-review)
14. [Content Security Policy Review](#14-content-security-policy-review)
15. [Compliance & Privacy Considerations](#15-compliance--privacy-considerations)
16. [Recommendations Summary](#16-recommendations-summary)
17. [Appendix A — Tested Files](#appendix-a--tested-files)
18. [Appendix B — Risk Matrix](#appendix-b--risk-matrix)

---

## 1. Executive Summary

Reflekt is a privacy-first AI journaling PWA that stores sensitive personal data (journal entries, AI conversations, health notes, dream logs) encrypted at rest using AES-GCM with PBKDF2-derived keys. The app supports optional cloud sync via Google Drive and biometric unlock via WebAuthn.

**Overall Security Posture: GOOD with notable gaps.**

The application demonstrates strong security-by-design principles: zero-knowledge architecture, client-side encryption, no server-side data access, and proper use of Web Crypto API. However, several findings — particularly around the biometric key storage model, OAuth token exposure, and the deterministic sync key — present real-world risks that should be addressed.

### Key Statistics

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 4 |
| Medium | 6 |
| Low | 5 |
| Informational | 4 |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client (PWA)                          │
│                                                         │
│  ┌──────────┐  ┌───────────┐  ┌───────────────────┐    │
│  │ React UI │──│ RxDB      │──│ IndexedDB         │    │
│  │          │  │ (Dexie)   │  │ (AES-GCM enc.)    │    │
│  └──────────┘  └───────────┘  └───────────────────┘    │
│       │                             │                    │
│  ┌──────────┐  ┌───────────┐  ┌───────────────────┐    │
│  │ WebAuthn │  │ Crypto    │  │ localStorage      │    │
│  │ (Biom.)  │  │ Services  │  │ (salt, tokens,    │    │
│  └──────────┘  └───────────┘  │  flags)            │    │
│       │                        └───────────────────┘    │
│       │             │                                    │
│  ┌──────────┐  ┌────┴──────┐                            │
│  │ Biom.    │  │ Google    │                             │
│  │ Keystore │  │ Drive API │                             │
│  │ (IDB)    │  └───────────┘                             │
│  └──────────┘       │                                    │
└─────────────────────│────────────────────────────────────┘
                      │
              ┌───────┴───────┐         ┌──────────────────┐
              │ CF Worker     │────────►│ Google OAuth2     │
              │ (auth proxy)  │         │ Token Endpoint    │
              └───────────────┘         └──────────────────┘
```

**Data Classification:**
- **Highly Sensitive:** Journal entries, AI conversations, health/dream data, API keys
- **Sensitive:** User password (never stored), encryption keys (in memory only)
- **Moderate:** OAuth tokens, sync metadata, biometric credential IDs
- **Low:** App settings (timezone, model preferences)

---

## 3. Threat Model

### 3.1 Threat Actors

| Actor | Capability | Motivation |
|-------|-----------|------------|
| **Opportunistic Attacker** | Physical device access (stolen/lost phone) | Data theft, identity theft |
| **Sophisticated Attacker** | Malware/rootkit on device | Targeted surveillance, data exfiltration |
| **Network Attacker (MitM)** | Network interception | Credential/token theft, data interception |
| **Malicious Browser Extension** | DOM/JS access within origin | API key theft, data exfiltration |
| **Cloud Provider Compromise** | Access to Google Drive appDataFolder | Encrypted data access |
| **Supply Chain Attacker** | Compromised npm dependency | Code injection, data exfiltration |

### 3.2 Attack Surface

| Surface | Components | Trust Level |
|---------|-----------|-------------|
| **Client Storage** | IndexedDB (encrypted), localStorage (plaintext), sessionStorage | Browser sandbox |
| **Network** | OpenRouter API, Google Drive API, Auth Worker, HuggingFace CDN | TLS 1.2+ |
| **Authentication** | Password (PBKDF2), WebAuthn (platform) | User + device |
| **Third-party Scripts** | Google Identity Services (`accounts.google.com/gsi/`) | External |
| **Service Worker** | Workbox-based caching | Same-origin |

---

## 4. Findings — Critical

### C-01: Biometric Wrapping Key Stored in Plaintext IndexedDB

**Severity:** CRITICAL
**CVSS:** 8.4 (AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)
**Location:** `src/db/DatabaseContext.tsx:256-267`, `src/services/biometric/keystore.service.ts:48-103`

**Description:**
The biometric unlock flow generates a random 32-byte AES-GCM wrapping key, uses it to wrap (encrypt) the database encryption key, and then stores **both** the wrapped key and the wrapping key in the same IndexedDB store (`reflekt_biometric_store`). The wrapping key is stored as a plaintext base64 string.

```typescript
// DatabaseContext.tsx:256-267
const exportedWrappingKey = await crypto.subtle.exportKey('raw', wrappingKey);
await storeEncryptedKey(
  credentialId,
  bytesToBase64(wrappedKey),        // encrypted db key
  bytesToBase64(new Uint8Array(exportedWrappingKey)),  // wrapping key IN PLAINTEXT
  bytesToBase64(wrappingSalt),
  bytesToBase64(iv),
  bytesToBase64(wrappedSyncKey),    // encrypted sync key
  bytesToBase64(syncIv)
);
```

**Impact:**
Any process with IndexedDB access to the origin can read the wrapping key and unwrap the database encryption key **without any biometric verification**. This completely bypasses the biometric gate. The WebAuthn authentication call (`authenticateBiometric()`) serves only as a UI ceremony — the cryptographic material is not bound to the biometric response.

**Attack Scenario:**
1. Attacker gains access to the device (unlocked phone, or malware with storage access)
2. Opens browser DevTools or uses a script to read `reflekt_biometric_store` IndexedDB
3. Reads `wrappingKey` (base64 plaintext) and `wrappedKey`
4. Unwraps the database encryption key using standard Web Crypto API
5. Opens and decrypts the entire journal database

**Remediation:**
- **Option A (Preferred):** Use WebAuthn PRF extension to derive the wrapping key from a biometric-bound secret. The PRF output is hardware-gated and never exposed to JavaScript unless the biometric succeeds. This eliminates the need to store the wrapping key.
- **Option B:** If PRF is not available, use the `largeBlob` WebAuthn extension to store the wrapping key in the authenticator's secure storage.
- **Option C (Minimum):** Encrypt the wrapping key with a secondary password or PIN that the user must enter. This adds a second factor beyond just having device access.

**Note:** The code has PRF infrastructure in place (`webauthn.service.ts:18-39`) but is not using it for key derivation. The comment at `DatabaseContext.tsx:113` states "PRF is no longer required - we use stored wrapping key approach instead," which trades significant security for broader device compatibility.

---

## 5. Findings — High

### H-01: OAuth Tokens in localStorage Vulnerable to XSS

**Severity:** HIGH
**CVSS:** 7.5 (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N)
**Location:** `src/services/google/auth.ts:32-34, 56-59, 167-171`

**Description:**
Google OAuth access tokens and refresh tokens are stored in `localStorage` as plaintext strings:

```typescript
const LS_TOKEN = 'reflekt_gdrive_token';
const LS_TOKEN_EXPIRES = 'reflekt_gdrive_token_expires';
const LS_REFRESH_TOKEN = 'reflekt_gdrive_refresh_token';
```

While the CSP is reasonably strict, any XSS vector (e.g., through a dependency vulnerability, CSP bypass, or `'unsafe-inline'` in `style-src`) would give an attacker access to:
- The Google Drive access token (short-lived, ~1 hour)
- The Google Drive refresh token (**long-lived, persists indefinitely until revoked**)

**Impact:**
With the refresh token, an attacker can:
1. Generate new access tokens at will via the auth worker
2. Download the encrypted sync file from Google Drive
3. Combined with other attacks (e.g., C-01), decrypt all journal data
4. Modify or delete the sync file, causing data corruption on other devices

**Remediation:**
- Store tokens in an `HttpOnly` cookie set by the Cloudflare Worker, making them inaccessible to JavaScript. The worker would proxy Drive API requests, attaching the token server-side.
- Alternatively, store tokens in a separate `SharedWorker` or `ServiceWorker` scope where they are less accessible to page-level XSS.
- At minimum, encrypt tokens before storing in localStorage using the derived encryption key.

### H-02: Auth Worker CORS Allows All Origins

**Severity:** HIGH
**CVSS:** 7.2 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
**Location:** `server/src/index.ts:8-12`

**Description:**
The Cloudflare Worker auth proxy responds with `Access-Control-Allow-Origin: *`:

```typescript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

**Impact:**
Any website can make requests to the auth worker endpoints. An attacker who obtains a Google authorization code (e.g., via phishing) can exchange it for tokens through this worker, or an attacker who steals a refresh token can use it to generate new access tokens from any origin.

**Remediation:**
- Restrict `Access-Control-Allow-Origin` to the production domain(s) only
- Add request origin validation in the worker
- Consider adding a CSRF token or API key requirement for the auth worker endpoints

### H-03: Deterministic Sync Key with Fixed Salt Enables Offline Dictionary Attacks

**Severity:** HIGH
**CVSS:** 7.0 (AV:L/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N)
**Location:** `src/services/crypto/keyDerivation.ts:97-112`

**Description:**
The sync encryption key is derived using a hardcoded, application-wide salt:

```typescript
const SYNC_SALT = new TextEncoder().encode('reflekt-journal-sync-v1');

export async function deriveSyncKey(password: string): Promise<CryptoKey> {
  return deriveKey(password, SYNC_SALT, CURRENT_ITERATIONS);
}
```

This is a deliberate design choice to enable cross-device sync without a key exchange protocol (same password → same key on any device). However, it has significant security implications:

**Impact:**
1. **Pre-computation attacks:** An attacker who knows the fixed salt can pre-compute a rainbow table of `PBKDF2(password, 'reflekt-journal-sync-v1', 310000, SHA-256)` outputs for common passwords. The 310K iterations make this expensive but not prohibitive for a motivated attacker with GPU resources.
2. **If the encrypted sync file is obtained** (via Google Drive access, stolen refresh token, or Google account compromise), the attacker only needs to brute-force the password against the known salt. There is no per-user salt to prevent parallel attacks against multiple users.
3. **Cross-user attacks:** All users share the same salt, so one computed dictionary serves for attacking any user's sync data.

**Remediation:**
- Implement a key exchange protocol: On first sync setup, generate a random per-user salt and store it (encrypted with the sync key) alongside the sync file as metadata. New devices request this salt from the cloud before deriving the sync key.
- Alternatively, use a strong key derivation with Argon2id instead of PBKDF2 for the sync key (Argon2 is memory-hard, making GPU attacks significantly more expensive).
- Enforce minimum password complexity requirements (currently no validation exists).

### H-04: No Password Strength Enforcement

**Severity:** HIGH
**CVSS:** 6.8 (AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
**Location:** `src/db/DatabaseContext.tsx:129-165` (setupPassword), `src/pages/Setup.tsx`

**Description:**
The password setup flow accepts any string as the encryption password with no minimum length, complexity, or entropy requirements. Since the password is the sole secret protecting all journal data (and, via the deterministic sync key, all cloud-synced data), a weak password directly translates to weak encryption.

**Impact:**
Users may choose passwords like "1234", "password", or their name — making PBKDF2 brute-force attacks trivial regardless of iteration count. A 4-digit PIN with 310K PBKDF2 iterations can be brute-forced in seconds.

**Remediation:**
- Enforce minimum 12-character password or equivalent entropy (e.g., zxcvbn score ≥ 3)
- Show a password strength meter during setup
- Warn users that this password protects all their journal data and cannot be recovered
- Consider supporting passphrase generation (e.g., 4+ random words from a diceware list)

---

## 6. Findings — Medium

### M-01: Encryption Key Marked as Extractable

**Severity:** MEDIUM
**CVSS:** 5.5 (AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N)
**Location:** `src/services/crypto/keyDerivation.ts:53-64`, `src/services/crypto/wrappingKey.ts:64-76`

**Description:**
The derived encryption key is created with `extractable: true`:

```typescript
return crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
  keyMaterial,
  { name: 'AES-GCM', length: KEY_LENGTH },
  true, // extractable
  ['encrypt', 'decrypt']
);
```

This is necessary because the key must be exported as hex for RxDB's encryption plugin. However, it means any JavaScript running in the page context can call `crypto.subtle.exportKey('raw', key)` on the key handle if they obtain a reference to it.

**Impact:**
If an attacker achieves code execution (XSS), they can export the raw key material from any in-memory `CryptoKey` reference. Non-extractable keys would at least prevent this.

**Remediation:**
- This is a limitation imposed by RxDB's encryption plugin requiring a hex key string. Consider contributing to or forking the plugin to accept a `CryptoKey` handle instead.
- In the interim, minimize the lifetime of extractable keys — derive the hex string immediately and then discard the CryptoKey reference.

### M-02: No Brute-Force Protection on Password Unlock

**Severity:** MEDIUM
**CVSS:** 5.3 (AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
**Location:** `src/db/DatabaseContext.tsx:168-204`

**Description:**
The unlock function has no rate limiting, lockout, or delay mechanism for failed password attempts. An attacker with physical device access can attempt passwords rapidly, limited only by PBKDF2 derivation time (~300ms per attempt on modern hardware).

**Impact:**
An attacker with device access could script automated password attempts against the unlock UI, testing ~200 passwords/minute. For a 4-digit PIN, this means full brute-force in ~50 minutes.

**Remediation:**
- Implement exponential backoff on failed attempts (e.g., 1s, 2s, 4s, 8s, ... delays)
- After N failed attempts (e.g., 10), require a cooldown period (e.g., 5 minutes)
- After M failed attempts (e.g., 30), wipe the encryption key or lock out permanently
- Store attempt counts in localStorage (survives page refresh but not data clear)

### M-03: Sensitive Data in Console Logs During Sync

**Severity:** MEDIUM
**CVSS:** 4.3 (AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N)
**Location:** `src/services/sync/engine.ts:75-162`

**Description:**
The sync engine logs extensive metadata to the browser console:

```typescript
console.log('[Sync] Downloaded remote data:', {
  days: remoteData!.days.length,
  messages: remoteData!.messages.length,
  // ...
});
console.log(`[Sync] Uploading merged data (${encrypted.length} bytes)...`);
```

While content is not logged, metadata (entry counts, byte sizes, sync timestamps) constitutes behavioral data that can be observed via DevTools, browser extensions with console access, or crash reporting services.

**Remediation:**
- Use a configurable log level system (debug/info/warn/error)
- Disable all sync logging in production builds
- Never log data sizes or counts that could reveal user activity patterns

### M-04: RxDB crypto-js Encryption Plugin Uses CBC Mode

**Severity:** MEDIUM
**CVSS:** 5.0 (AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N)
**Location:** `src/db/index.ts` (wrappedKeyEncryptionCryptoJsStorage)

**Description:**
RxDB's `wrappedKeyEncryptionCryptoJsStorage` plugin internally uses crypto-js, which defaults to AES-CBC mode (not AES-GCM). While the custom sync encryption correctly uses AES-GCM via Web Crypto API, the at-rest database encryption uses the less secure CBC mode.

**Impact:**
- AES-CBC does not provide authenticated encryption. A sophisticated attacker could modify ciphertext without detection (bit-flipping attacks).
- crypto-js is a legacy library with known issues around PBKDF2 performance and has had security concerns raised in the community.

**Remediation:**
- Consider migrating to RxDB's native encryption plugin or a custom storage wrapper that uses Web Crypto API with AES-GCM
- At minimum, verify that the crypto-js configuration includes HMAC-based integrity verification

### M-05: Unvalidated `redirect_uri` in Auth Worker

**Severity:** MEDIUM
**CVSS:** 5.4 (AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N)
**Location:** `server/src/index.ts:21-25`

**Description:**
The auth worker's `/auth/exchange` endpoint accepts a `redirect_uri` parameter from the client and passes it directly to Google's token endpoint:

```typescript
const { code, redirect_uri } = (await request.json()) as {
  code: string;
  redirect_uri: string;
};
// ... passed directly to Google OAuth
```

While Google validates the redirect_uri against the OAuth client configuration, the worker does not independently validate it. Combined with H-02 (open CORS), this could facilitate token theft in a sophisticated OAuth redirect attack.

**Remediation:**
- Hardcode or whitelist the expected `redirect_uri` values in the worker
- Validate the `redirect_uri` against a known list before forwarding to Google

### M-06: No Integrity Verification on Exported/Imported Data

**Severity:** MEDIUM
**CVSS:** 4.6 (AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N)
**Location:** `src/services/db/export.ts`, `src/services/db/import.ts`

**Description:**
The data export/import feature produces an unencrypted JSON file with Zod schema validation on import, but no HMAC or digital signature to verify data integrity or authenticity.

**Impact:**
An attacker who intercepts or modifies an export file could:
1. Inject crafted journal entries that would pass Zod validation
2. Modify message timestamps to alter merge behavior during sync
3. Inject messages with malicious content that could trigger XSS if rendered without sanitization

**Remediation:**
- Add an HMAC (keyed with the encryption key) to export files
- Encrypt export files using the user's encryption key
- Validate imported data more strictly (e.g., UUID format, timestamp ranges, content length limits)

---

## 7. Findings — Low

### L-01: Salt Stored in localStorage Without Integrity Protection

**Severity:** LOW
**CVSS:** 3.7 (AV:L/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:N)
**Location:** `src/db/DatabaseContext.tsx:137`

**Description:**
The PBKDF2 salt is stored in `localStorage` without any integrity check. An attacker with localStorage write access could replace the salt, causing the user to derive a different (attacker-known) key on next unlock. This would fail to open the existing database, but could be part of a more complex attack to redirect the user to a fresh database controlled by the attacker.

**Remediation:**
- Store an HMAC of the salt (keyed with a device-specific value) alongside it
- Alternatively, store the salt in IndexedDB within the encrypted database itself

### L-02: WebAuthn Challenge Not Server-Verified

**Severity:** LOW
**CVSS:** 3.1 (AV:L/AC:H/PR:N/UI:R/S:U/C:N/I:L/A:N)
**Location:** `src/services/biometric/webauthn.service.ts:54, 168`

**Description:**
WebAuthn challenges are generated client-side and never verified server-side:

```typescript
const challenge = crypto.getRandomValues(new Uint8Array(32));
```

In a server-verified WebAuthn flow, the server generates the challenge and verifies the signed response. Here, since authentication is purely client-side, the challenge serves no cryptographic purpose — it's random but never checked.

**Impact:**
This is expected for a client-only app and doesn't directly enable attacks. However, it means the WebAuthn ceremony only proves the user is physically present and passes biometric — it provides no replay protection or server-side assurance.

**Remediation:**
- Accepted risk for a client-only architecture. Document this limitation.
- If a server component is added in the future, implement proper challenge-response verification.

### L-03: `style-src 'unsafe-inline'` in CSP

**Severity:** LOW
**CVSS:** 3.4 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N)
**Location:** `index.html:13`

**Description:**
The Content Security Policy includes `style-src 'self' 'unsafe-inline'`, which allows inline styles. This weakens the CSP against style-based injection attacks and can be a stepping stone for data exfiltration (e.g., CSS-based keyloggers).

**Remediation:**
- Use nonce-based or hash-based style CSP if possible
- If `'unsafe-inline'` is required for the styling framework, document the accepted risk

### L-04: `wasm-unsafe-eval` in CSP

**Severity:** LOW
**CVSS:** 2.8 (AV:L/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N)
**Location:** `index.html:13`

**Description:**
The CSP includes `'wasm-unsafe-eval'` for WebAssembly execution (used for on-device ML models). This directive allows execution of WebAssembly code that could be loaded from cached sources.

**Remediation:**
- Accepted risk for the ML model functionality. Verify that WASM files are loaded from trusted sources only and integrity-checked.

### L-05: Sync File ID Cached in localStorage

**Severity:** LOW
**CVSS:** 2.5 (AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:N/A:N)
**Location:** `src/services/sync/engine.ts:88-93`

**Description:**
The Google Drive file ID for the sync file is cached in localStorage. If manipulated, it could cause the sync engine to target a different file (though the file must be in the appDataFolder and encrypted).

**Remediation:**
- Validate the cached file ID on each sync by confirming the filename matches

---

## 8. Findings — Informational

### I-01: API Key in .env File

**Location:** `.env:3`

The `.env` file contains a real OpenRouter API key. While `.env` is listed in `.gitignore`, the key should be rotated if this file was ever committed to version control. Verify git history.

### I-02: Soft Deletes Retain Sensitive Data

**Location:** `src/services/db/schemas.ts` (all schemas with `deletedAt`)

Deleted messages, notes, and summaries are soft-deleted (marked with a `deletedAt` timestamp) rather than permanently removed. This means sensitive content remains in the encrypted database and is included in sync payloads. Users who "delete" a message may not realize it persists.

### I-03: No Session Timeout for Unlocked Database

The database remains unlocked until the page is backgrounded (visibility change). There is no idle timeout — if the user leaves their device with the app in the foreground, it remains accessible indefinitely.

### I-04: Password Change Creates Data Window

**Location:** `src/db/DatabaseContext.tsx:441-596`

During password change, all data is decrypted, the database is deleted and recreated, and data is re-encrypted with the new key. During this window (~1-10 seconds), all plaintext data exists in JavaScript memory. If the process is interrupted, data could be lost.

---

## 9. Device Compromise Scenarios

### Scenario 1: Phone Stolen (Locked Device)

| Factor | Status |
|--------|--------|
| Device lock screen | **PROTECTED** — attacker cannot access app |
| IndexedDB encrypted at rest | **PROTECTED** — requires password or biometric |
| localStorage tokens | **PROTECTED** — inaccessible behind device lock |

**Risk: LOW** — Standard device security (PIN/biometric) protects the app.

### Scenario 2: Phone Stolen (Unlocked Device, App Backgrounded)

| Factor | Status |
|--------|--------|
| Auto-lock on background | **PROTECTED** — `useVisibilityChange` triggers lock |
| Privacy overlay | **PROTECTED** — content hidden in task switcher |
| Need to re-authenticate | **PROTECTED** — password or biometric required |

**Risk: LOW** — Auto-lock mechanism provides good protection.

### Scenario 3: Phone Stolen (Unlocked Device, App in Foreground)

| Factor | Status |
|--------|--------|
| Database unlocked in memory | **EXPOSED** — all data accessible |
| No idle timeout | **EXPOSED** — remains unlocked indefinitely |
| API key accessible | **EXPOSED** — can be read from settings |

**Risk: HIGH** — Attacker has full access to all journal data and API key.

**Recommendation:** Add configurable idle timeout (e.g., 5 minutes of no interaction).

### Scenario 4: Device Infected with Malware/Spyware

| Factor | Status |
|--------|--------|
| IndexedDB accessible | **EXPOSED** — malware can read browser storage |
| Biometric wrapping key | **EXPOSED** — plaintext in IndexedDB (C-01) |
| OAuth tokens | **EXPOSED** — plaintext in localStorage (H-01) |
| Encryption key in memory | **EXPOSED** — extractable CryptoKey (M-01) |
| Password | **EXPOSED** — keylogger can capture during entry |
| Network traffic | **PROTECTED** — TLS encrypts API calls |

**Risk: CRITICAL** — Malware with browser storage access compromises all data.

This is the most severe scenario. Once malware has access to browser APIs:
1. Read biometric wrapping key from IndexedDB → unwrap encryption key → decrypt all data
2. Read OAuth refresh token → access Google Drive sync file → decrypt with derived key
3. Intercept password entry → derive all keys
4. Hook `crypto.subtle` to capture key material during operations

**Mitigation (defense in depth):**
- Use non-extractable keys where possible
- Implement PRF-based biometric (hardware-bound secrets)
- Store OAuth tokens server-side (HttpOnly cookies)
- Encourage users to use device-level malware protection

### Scenario 5: Google Account Compromised

| Factor | Status |
|--------|--------|
| Sync file accessible | **EXPOSED** — attacker can download encrypted file |
| Sync file encrypted | **PROTECTED** — AES-GCM with password-derived key |
| Deterministic salt | **WEAKENED** — known salt enables targeted brute-force |

**Risk: MEDIUM** — Data remains encrypted, but the fixed salt reduces the attack cost. A weak password could be cracked.

### Scenario 6: Browser Extension Attack

| Factor | Status |
|--------|--------|
| DOM access | **EXPOSED** — extensions can read rendered content |
| localStorage | **EXPOSED** — extensions can read all entries |
| IndexedDB | **EXPOSED** — extensions can read all databases |
| CSP | **PARTIAL** — CSP doesn't restrict extensions |

**Risk: HIGH** — A malicious browser extension has equivalent access to malware for web content.

---

## 10. Sync & Cloud Security Analysis

### 10.1 Encryption Assessment

| Property | Implementation | Rating |
|----------|---------------|--------|
| Algorithm | AES-GCM 256-bit | Excellent |
| Key Derivation | PBKDF2-SHA256, 310K iterations | Good |
| IV Generation | 12 bytes random per encryption | Correct |
| Salt (local) | 16 bytes random per user | Correct |
| Salt (sync) | Fixed application-wide | **Weak** |

### 10.2 Sync Data Flow Security

```
Password ──→ PBKDF2(password, FIXED_SALT, 310K) ──→ Sync Key
                                                          │
Local Data ──→ JSON.stringify() ──→ AES-GCM-encrypt ────►│
                                                          │
Google Drive ◄── Upload encrypted blob ◄──────────────────┘
```

**Concerns:**
1. **Full database export per sync:** Each sync uploads the entire dataset, not incremental changes. This means the encrypted blob grows linearly with data size, and older versions of the encrypted file may be recoverable from Google Drive revision history.
2. **No forward secrecy:** If the sync key is compromised, all historical sync data is decryptable.
3. **Merge conflicts resolved by timestamp:** An attacker who can write to the sync file could inject entries with future timestamps to override legitimate entries.
4. **30-second debounce:** Changes are visible in plaintext in memory for up to 30 seconds before being encrypted and synced.

### 10.3 Google Drive Scope

The app requests `drive.appdata` scope, which limits access to the app's hidden folder. This is the minimum necessary scope — well chosen. However, a compromised OAuth token still grants read/write to this folder.

---

## 11. Biometric Authentication Analysis

### 11.1 Architecture

The biometric system uses a two-layer approach:

```
                    ┌──────────────────┐
                    │  WebAuthn        │
                    │  (biometric gate)│
                    └────────┬─────────┘
                             │ authenticates user
                             ▼
┌─────────────┐    ┌──────────────────┐    ┌───────────────┐
│ Wrapped Key │──► │ Wrapping Key     │──► │ Encryption    │
│ (encrypted) │    │ (PLAINTEXT in    │    │ Key (unwrapped│
│             │    │  IndexedDB)      │    │ for DB use)   │
└─────────────┘    └──────────────────┘    └───────────────┘
```

### 11.2 Critical Gap

The WebAuthn ceremony is a **ceremony only** — it verifies the user is present and passes biometric, but the result is not cryptographically linked to the key unwrapping. The wrapping key sits in plaintext IndexedDB, and the unwrapping uses standard `crypto.subtle.unwrapKey()` with no dependency on the WebAuthn response.

**What this means for users:**
- Biometric unlock is a **convenience feature**, not a security feature
- It provides protection only against casual observation (someone watching over your shoulder)
- It does NOT protect against: malware, browser extensions, forensic analysis, or DevTools access

### 11.3 Platform-Specific Considerations

| Platform | Biometric Type | Hardware Binding |
|----------|---------------|-----------------|
| iOS (Safari) | Face ID / Touch ID | WebAuthn key in Secure Enclave, but wrapping key in IDB is not |
| Android (Chrome) | Fingerprint / Face | Same limitation |
| macOS (Safari) | Touch ID | Same limitation |
| Windows (Edge/Chrome) | Windows Hello | Same limitation |

On all platforms, the hardware biometric protects the WebAuthn credential, but the wrapping key (the actual secret needed to decrypt data) is stored outside the secure hardware.

---

## 12. Token & Key Management Analysis

### 12.1 Key Lifecycle

| Key | Generation | Storage | Lifetime | Rotation |
|-----|-----------|---------|----------|----------|
| PBKDF2 Salt | `crypto.getRandomValues(16)` | localStorage (base64) | Permanent (until password change) | On password change |
| Encryption Key | PBKDF2(password, salt, 310K) | In-memory CryptoKey (extractable) | Session (until lock) | On password change |
| Sync Key | PBKDF2(password, FIXED_SALT, 310K) | In-memory CryptoKey | Session (until lock) | On password change |
| Biometric Wrapping Key | `crypto.getRandomValues(32)` | IndexedDB (plaintext base64) | Permanent (until biometric re-setup) | On biometric re-setup |
| OpenRouter API Key | User-provided | RxDB (encrypted field) | Permanent | Manual |
| Google Access Token | OAuth exchange | localStorage (plaintext) | ~1 hour | Auto-refresh |
| Google Refresh Token | OAuth exchange | localStorage (plaintext) | Indefinite | On re-auth |

### 12.2 Key Concerns

1. **Encryption key extractability:** Required by RxDB but increases risk surface
2. **Biometric wrapping key:** Stored plaintext (see C-01)
3. **No key derivation function for API key:** The OpenRouter API key is stored as-is in the encrypted database, which is correct, but if the key is copied to clipboard or displayed in UI, it could leak
4. **OAuth tokens:** Should be stored server-side (see H-01)
5. **No mechanism to detect key compromise:** If keys are extracted, there's no detection or revocation mechanism

### 12.3 OpenRouter API Key Flow

```
User input ──→ RxDB settings (encrypted field) ──→ Read on demand ──→ HTTP header
```

The API key is properly stored in an encrypted database field (`encrypted: ['openRouterApiKey']` in schema). It is only read into memory when making API calls. This is a solid implementation.

**Concern:** The API key is sent directly from the browser to OpenRouter, visible in the `Authorization` header. If a proxy or network inspection tool is active, the key could be captured. The `HTTP-Referer` header is set to the page origin, which OpenRouter uses for abuse prevention.

---

## 13. Cryptographic Implementation Review

### 13.1 Algorithm Selection

| Purpose | Algorithm | Key Size | Assessment |
|---------|-----------|----------|------------|
| Data at rest (local) | AES-CBC (crypto-js via RxDB) | 256-bit | Adequate, prefer GCM |
| Data in transit (sync) | AES-GCM (Web Crypto) | 256-bit | Excellent |
| Key derivation | PBKDF2-SHA256 | 310K iterations | Good (NIST SP 800-132 compliant) |
| Key wrapping | AES-GCM (Web Crypto) | 256-bit | Excellent |
| Biometric (future) | HKDF-SHA256 | 256-bit | Correct |
| WebAuthn signing | ES256 / RS256 | Standard | Correct |

### 13.2 IV/Nonce Management

- **Sync encryption:** Random 12-byte IV per encryption — **correct**
- **Key wrapping:** Random 12-byte IV per wrap — **correct**
- **IV reuse risk:** IVs are generated fresh each time; no counter-based scheme that could wrap — **low risk**
- **AES-GCM nonce limit:** AES-GCM with a 96-bit random nonce has a collision probability of ~2^-32 after 2^32 encryptions. Given this is a personal journal app, this limit will never be reached — **acceptable**

### 13.3 PBKDF2 Parameters

- **Iterations (current):** 310,000 — aligns with NIST SP 800-132 (2023) recommendations
- **Iterations (legacy):** 100,000 — below current recommendation but migrated on next unlock
- **Hash:** SHA-256 — standard choice
- **Salt length:** 16 bytes (128 bits) — sufficient
- **Key length:** 256 bits — maximum for AES

**Benchmark:** At 310K iterations on a modern GPU (RTX 4090):
- ~2,500 guesses/second per GPU
- 6-character lowercase password: ~5 hours
- 8-character mixed password: ~centuries
- 4-digit PIN: ~4 seconds

**Conclusion:** The iteration count is appropriate for strong passwords but insufficient for PINs or short passwords. This reinforces the need for H-04 (password strength enforcement).

### 13.4 Entropy Sources

All random values use `crypto.getRandomValues()` (CSPRNG) — **correct**. No use of `Math.random()` for security purposes was found.

---

## 14. Content Security Policy Review

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval' 'sha256-...' 'sha256-...' https://accounts.google.com/gsi/;
style-src 'self' 'unsafe-inline';
connect-src 'self' https://openrouter.ai https://huggingface.co https://*.huggingface.co
            https://cdn.jsdelivr.net https://accounts.google.com https://www.googleapis.com
            https://oauth2.googleapis.com http://localhost:8787
            https://reflekt-auth-worker.mateotomasgomez.workers.dev;
img-src 'self' data: blob:;
worker-src 'self' blob:;
font-src 'self' data:;
frame-src 'self' https://rxdb.info/ https://accounts.google.com;
```

### Assessment

| Directive | Rating | Notes |
|-----------|--------|-------|
| `default-src` | Good | Restrictive default |
| `script-src` | Acceptable | SHA-hashed inline scripts, Google GIS required, `wasm-unsafe-eval` for ML |
| `style-src` | Weak | `unsafe-inline` allows style injection |
| `connect-src` | Acceptable | External API endpoints are necessary; `http://localhost:8787` should be removed in production |
| `img-src` | Good | `data:` and `blob:` needed for dynamic content |
| `worker-src` | Acceptable | `blob:` needed for Workbox service worker |
| `frame-src` | Acceptable | RxDB info frame and Google sign-in |
| Missing: `form-action` | Gap | Should add `form-action 'self'` to prevent form hijacking |
| Missing: `base-uri` | Gap | Should add `base-uri 'self'` to prevent base tag injection |
| Missing: `object-src` | Gap | Should add `object-src 'none'` |

### Specific Concerns

1. **`http://localhost:8787`** in `connect-src` — This development URL should be removed in production builds. An attacker on the local network could set up a listener on port 8787 to intercept auth requests.
2. **`https://rxdb.info/`** in `frame-src` — This appears to be for the RxDB premium plugin. If removed, it reduces the CSP surface.
3. **No `upgrade-insecure-requests`** — Consider adding to force HTTPS for all resources.

---

## 15. Compliance & Privacy Considerations

### 15.1 GDPR (if serving EU users)

| Requirement | Status |
|-------------|--------|
| Data minimization | **COMPLIANT** — App collects only journal data created by the user |
| Right to erasure | **PARTIAL** — "Forgot password" deletes all data, but soft deletes retain data in DB |
| Data portability | **COMPLIANT** — Export feature produces JSON |
| Consent for cloud storage | **COMPLIANT** — Google Drive sync is opt-in |
| Data processing transparency | **NEEDS REVIEW** — OpenRouter processes journal content; users should be informed of this |

### 15.2 Privacy-Relevant Design Decisions

**Positive:**
- Zero-knowledge architecture (server has no access to plaintext)
- Privacy overlay prevents screenshot in task switcher
- Auto-lock on background
- Opt-in cloud sync
- Data stays on-device by default
- No analytics or telemetry detected

**Negative:**
- Journal content is sent to OpenRouter for AI processing (necessary for functionality, but constitutes third-party data processing)
- Google OAuth reveals the user's Google account to the app
- HuggingFace model downloads could reveal the user's IP and usage patterns to Hugging Face

### 15.3 Data Breach Impact Assessment

If all data is compromised, the attacker gains access to:
- Personal journal entries (potentially years of intimate thoughts)
- Health information and dream logs
- AI conversation history (may contain sensitive topics)
- User's Google account identity (via OAuth)
- OpenRouter API key (financial liability)

**Severity of breach: VERY HIGH** — Journal data is among the most sensitive personal data that can exist.

---

## 16. Recommendations Summary

### Immediate (Sprint 1) — Critical & High

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 1 | C-01 | Implement PRF-based biometric key derivation; fall back to stored key only when PRF unavailable with clear user warning | Large |
| 2 | H-01 | Move OAuth tokens to HttpOnly cookies via the auth worker | Medium |
| 3 | H-02 | Restrict CORS to production domains | Small |
| 4 | H-04 | Add password strength validation (zxcvbn) and minimum entropy requirement | Small |

### Short-term (Sprint 2-3) — Medium

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 5 | H-03 | Add per-user sync salt (stored encrypted in Drive metadata) | Medium |
| 6 | M-02 | Add exponential backoff and lockout on failed password attempts | Small |
| 7 | M-03 | Strip console.log statements in production builds | Small |
| 8 | M-04 | Evaluate migration from crypto-js to Web Crypto API for RxDB encryption | Large |
| 9 | M-05 | Validate redirect_uri in auth worker | Small |
| 10 | M-06 | Add HMAC integrity checking to export files; optionally encrypt exports | Medium |

### Long-term (Backlog) — Low & Informational

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 11 | L-01 | Add salt integrity verification | Small |
| 12 | L-03 | Move to nonce-based style CSP | Medium |
| 13 | I-01 | Verify .env was never committed; rotate API key | Small |
| 14 | I-02 | Add hard-delete option and document soft-delete behavior | Medium |
| 15 | I-03 | Add configurable idle timeout | Small |
| 16 | I-04 | Add crash recovery mechanism for password change flow | Medium |
| 17 | — | Add `form-action`, `base-uri`, `object-src` CSP directives | Small |
| 18 | — | Remove `http://localhost:8787` from production CSP | Small |
| 19 | — | Consider Argon2id for key derivation (WebAssembly implementation) | Large |
| 20 | — | Add Subresource Integrity (SRI) for third-party scripts | Medium |

---

## Appendix A — Tested Files

| Category | Files Reviewed |
|----------|----------------|
| Cryptography | `src/services/crypto/encryption.ts`, `keyDerivation.ts`, `wrappingKey.ts`, `index.ts` |
| Biometric | `src/services/biometric/webauthn.service.ts`, `keystore.service.ts`, `detection.service.ts`, `types.ts` |
| Database | `src/db/index.ts`, `src/db/DatabaseContext.tsx`, `src/services/db/schemas.ts`, `database.ts` |
| Auth & Session | `src/services/google/auth.ts`, `src/utils/session.utils.ts`, `src/pages/UnlockPage.tsx`, `ForgotPasswordPage.tsx`, `Setup.tsx` |
| Sync | `src/services/sync/engine.ts`, `src/services/google/drive.ts`, `src/contexts/SyncContext.tsx` |
| Network | `src/utils/fetch.ts`, `src/services/ai/streaming-connection.ts`, `src/utils/rate-limiter.ts` |
| Data Mgmt | `src/services/db/export.ts`, `src/services/db/import.ts`, `src/services/settings/data-management.service.ts` |
| Server | `server/src/index.ts` |
| Config | `index.html`, `vite.config.ts`, `.env`, `.gitignore` |

---

## Appendix B — Risk Matrix

```
              ┌─────────────────────────────────────────┐
   IMPACT     │                                         │
              │  HIGH    │ H-03     │ C-01    │          │
              │          │ H-04     │         │          │
              ├──────────┼──────────┼─────────┤          │
              │  MEDIUM  │ M-04     │ H-01    │          │
              │          │ M-06     │ H-02    │          │
              ├──────────┼──────────┼─────────┤          │
              │  LOW     │ L-01     │ M-02    │          │
              │          │ L-02     │ M-03    │          │
              │          │ L-05     │ M-05    │          │
              ├──────────┼──────────┼─────────┤          │
              │          │  LOW     │  MEDIUM │  HIGH    │
              │          │       LIKELIHOOD              │
              └─────────────────────────────────────────┘
```

---

*End of Security Audit Report*

*This report is confidential and intended for the development team only. Findings should be addressed according to the priority schedule outlined in Section 16. A follow-up audit is recommended after remediations are implemented.*
