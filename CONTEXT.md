# AI Journaling

A privacy-focused daily journaling app. This context covers the shared domain — journal data, AI-assisted capture, and data portability — as implemented across the React PWA and the Flutter mobile app.

## Language

**Backup**:
A one-way export of a user's encrypted local database to their own Google Drive `appDataFolder`, for disaster recovery on a single account.
_Avoid_: Sync

**Sync**:
Bidirectional propagation of the same encrypted data across multiple devices, via the E2E encrypted cloud backend (Cloudflare Workers/D1/R2).
_Avoid_: Backup

## Relationships

- A **Backup** targets exactly one Google account's `appDataFolder`; it does not coordinate state between devices.
- **Sync** requires the cloud backend and matching client-side crypto on every participating client; **Backup** does not.

## Example dialogue

> **Dev:** "Does the Flutter app sync with the PWA?"
> **Domain expert:** "Not in v1 — it backs up to Google Drive. Sync (multi-device, real-time, shared backend) is deferred."

## Flagged ambiguities

- "Quantum encryption" was used to mean resistance to quantum-computer attacks — resolved: the precise term is **post-quantum cryptography**, which targets asymmetric algorithms (RSA/ECC) broken by Shor's algorithm. This app uses only symmetric crypto (AES-256-GCM, PBKDF2, HKDF) — already considered quantum-resistant, since Grover's algorithm only halves effective key strength. No post-quantum work is needed for the current design.
