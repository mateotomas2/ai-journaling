# AI Journaling

A privacy-focused daily journaling app. This context covers the shared domain — journal data, AI-assisted capture, and data portability — as implemented across the React PWA and the Flutter mobile app.

## Language

**Backup**:
A one-way export of a user's encrypted local database to their own Google Drive `appDataFolder`, for disaster recovery on a single account.
_Avoid_: Sync

**Sync**:
Bidirectional propagation of the same encrypted data across multiple devices, via the E2E encrypted cloud backend (Cloudflare Workers/D1/R2).
_Avoid_: Backup

**Sign in**:
Proving *identity* to Google, which grants access to the Drive `appDataFolder`. Grants no ability to read journal content.
_Avoid_: Log in, authenticate

**Unlock**:
Proving possession of the user's password, which yields the *key* that decrypts the journal. Independent of **Sign in**.
_Avoid_: Log in, authenticate

**Password**:
The user-chosen secret the journal key is derived from. The only thing that can decrypt a journal, and unrecoverable if forgotten.
_Avoid_: PIN, passcode, credentials

## Relationships

- A **Backup** targets exactly one Google account's `appDataFolder`; it does not coordinate state between devices.
- **Sync** requires the cloud backend and matching client-side crypto on every participating client; **Backup** does not.
- **Sign in** and **Unlock** are orthogonal: signing in reaches the storage, unlocking reads the contents. Doing one never implies the other.
- A **Password** produces the key; **Biometrics** only unlock a wrapped copy of that key on a device already set up, and can never reproduce it.

## Example dialogue

> **Dev:** "Does the Flutter app sync with the PWA?"
> **Domain expert:** "Not in v1 — it backs up to Google Drive. Sync (multi-device, real-time, shared backend) is deferred."

> **Dev:** "If we add login with Google, we don't need a password, right?"
> **Domain expert:** "Those answer different questions. **Sign in** says which Drive to write to. **Unlock** says who can read what's in it. Drop the **Password** and the key has to live somewhere Google can reach — at which point signing in *is* reading the journal."

## Flagged ambiguities

- "Login with Google" was used to mean both **Sign in** and **Unlock** — resolved: they are separate concepts, and conflating them silently removes end-to-end encryption. See ADR-0006.
- "Quantum encryption" was used to mean resistance to quantum-computer attacks — resolved: the precise term is **post-quantum cryptography**, which targets asymmetric algorithms (RSA/ECC) broken by Shor's algorithm. This app uses only symmetric crypto (AES-256-GCM, PBKDF2, HKDF) — already considered quantum-resistant, since Grover's algorithm only halves effective key strength. No post-quantum work is needed for the current design.
