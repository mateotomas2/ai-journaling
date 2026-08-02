---
status: accepted
---

# Deleting a note erases its content and leaves a tombstone

The PWA soft-deletes: `deletedAt` moves from `0` to a timestamp and the row —
content and all — stays in the database. That is the usual choice, and it exists
for a good reason: a backup or sync that only ever sees rows cannot tell "this
note was deleted" from "this device has not seen that note yet", so without a
tombstone a delete on one device is undone by the next restore.

But it is the wrong default for this product. Someone deleting a journal entry
means *make it go away*, and a row that quietly keeps the text is a promise
broken quietly. The database is encrypted, which limits the damage, but the
person holding the password is exactly who deleted the note.

So deleting does both: the row survives as a **tombstone** — its id, its day and
a `deletedAt` timestamp — and its **content is overwritten with an empty
string** in the same write. Sync keeps the fact of the deletion; nobody keeps
the writing.

## Consequences

Undo is impossible by construction. If undo is wanted later it has to be a
window *before* the erasure, not a restore afterwards — which is a better
design anyway, since a deleted note that can be resurrected is not deleted.

Queries must filter tombstones (`deletedAt = 0`), and forgetting to do so shows
an empty note rather than a missing one, which is a quiet kind of wrong. That
filter belongs in the query layer, not at each call site.
