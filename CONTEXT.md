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

**Note**:
A durable entry belonging to one day. The user's own material, whether they wrote it by hand or asked the assistant to write it down — a note has no memory of which.
_Avoid_: Entry, summary

**Chat**:
The conversation belonging to one day. A second way of putting something into that day, alongside writing a note.
_Avoid_: Thread, session, ask

**Message**:
One turn of a **Chat**, by the person or by the assistant. A person's message is their own writing; an assistant's message is not.
_Avoid_: Exchange

**Meaning search**:
Finding writing by what it was about rather than by the words it used. Reaches only what the *person* wrote — their **Notes** and their own **Messages**.
_Avoid_: Semantic search, vector search, memory

## Relationships

- A **Backup** targets exactly one Google account's `appDataFolder`; it does not coordinate state between devices.
- **Sync** requires the cloud backend and matching client-side crypto on every participating client; **Backup** does not.
- **Sign in** and **Unlock** are orthogonal: signing in reaches the storage, unlocking reads the contents. Doing one never implies the other.
- A **Password** produces the key; **Biometrics** only unlock a wrapped copy of that key on a device already set up, and can never reproduce it.
- A day holds **Notes** and one **Chat**. Both are ways of putting something into that day; neither is derived from the other.
- A **Note** the assistant wrote is still a **Note** — editable, deletable, and indistinguishable from one written by hand.
- **Meaning search** covers **Notes** and the person's own **Messages**. An assistant's **Message** is never reachable by it: it is the machine restating what the person already wrote.

## Example dialogue

> **Dev:** "Does the Flutter app sync with the PWA?"
> **Domain expert:** "Not in v1 — it backs up to Google Drive. Sync (multi-device, real-time, shared backend) is deferred."

> **Dev:** "Should the index cover everything?"
> **Domain expert:** "Everything the *person* wrote. Their **Notes** and their own **Messages**. Index the assistant's replies and searching your journal starts returning the machine paraphrasing you, ranked above the thing you actually wrote."

> **Dev:** "If we add login with Google, we don't need a password, right?"
> **Domain expert:** "Those answer different questions. **Sign in** says which Drive to write to. **Unlock** says who can read what's in it. Drop the **Password** and the key has to live somewhere Google can reach — at which point signing in *is* reading the journal."

## Flagged ambiguities

- "Login with Google" was used to mean both **Sign in** and **Unlock** — resolved: they are separate concepts, and conflating them silently removes end-to-end encryption. See ADR-0006.
- "Index everything" was used to mean both every stored record and everything the user wrote — resolved: **Meaning search** covers **Notes** and the person's own **Messages** only. Indexing assistant replies feeds derived text back into the corpus the next question retrieves from.
- "Ask" named a separate whole-journal question screen, distinct from the per-day **Chat** — resolved: there is one conversational surface, the **Chat**. Reaching other days is something the assistant does, not somewhere the user goes.
- "Quantum encryption" was used to mean resistance to quantum-computer attacks — resolved: the precise term is **post-quantum cryptography**, which targets asymmetric algorithms (RSA/ECC) broken by Shor's algorithm. This app uses only symmetric crypto (AES-256-GCM, PBKDF2, HKDF) — already considered quantum-resistant, since Grover's algorithm only halves effective key strength. No post-quantum work is needed for the current design.
