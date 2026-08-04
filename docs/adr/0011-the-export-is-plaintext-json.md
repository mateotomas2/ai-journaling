---
status: accepted
---

# The export is plaintext JSON

Reflekt had no way to get anything out: the database is encrypted with a key derived from an unrecoverable password, so a lost phone or a forgotten password took the whole journal with it. The export it now writes is **plaintext JSON** — readable by the person who made it, by another app, or by anything else that opens the file.

That is a deliberate relaxation of the app's central promise, and it is the point: an export only Reflekt can read is a backup, not an export, and backup is what Google Drive is for (ADR-0004).

## Considered options

**Encrypted blob.** Safe by construction and consistent with everything else here. Rejected because it only restores into this app — it does not answer "I want my writing somewhere else", which is the actual reason to want an export.

**Both, with plaintext behind a warning.** The eventual answer, and probably where this ends up. Deferred: shipping one path well beats shipping two half-explained, and the plaintext one is the one with a reason to exist first.

## Consequences

A file on a phone that anyone with the phone can read. The journal is encrypted at rest right up until someone exports it, and then it is not — that is a real hole in the story and it should be said plainly wherever the button lives, not buried.

**The API key is never exported.** It is a live credential that can spend the owner's money, it lives in the same settings table as everything else, and it is not journal content. Excluding it is not a detail — a plaintext file carrying someone's OpenRouter key is a different and much worse artefact than one carrying their notes.

Deleted notes and messages are not exported either. A tombstone exists so a deletion cannot be undone (ADR-0007), and writing erased rows into a file someone might re-import would work against that.

Embeddings are left out as derived data; `IndexBackfill` rebuilds them after an import.
