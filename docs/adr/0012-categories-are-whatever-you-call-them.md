---
status: accepted
---

# Categories are whatever you call them

A note's category was one of four: personal, health, dream, insight. `note_category.dart` argued for that closed set deliberately — open-ended tags let a journal grow a vocabulary nobody can remember, and the point is to be able to scan a day rather than to file it. Categories are now free text, matching the PWA.

That argument was not wrong, and this supersedes it rather than dismissing it.

## Why the other way won

The four were chosen by us, for someone else's life. A fixed set is a claim about what a person's days contain, and four is a small claim — it has nothing for work, for the people they live with, or for whatever they are actually preoccupied with this year. Someone who wants to mark a note "mum" has no way to say so, and no way to ask for one.

The two clients also disagreed, which matters now that a journal can move between them as a file (ADR-0011). An import from the PWA carrying "work" would have arrived as a note with a category Reflekt refuses to show.

## Consequences

**The vocabulary can sprawl, and nothing prevents it.** That is the cost, taken knowingly. It is mitigated rather than solved: the composer offers what the journal already uses before it offers a blank field, so reaching for an existing word is easier than coining a new one.

**`write_note` has to be told this.** The tool used to name the four. It now tells the model to reuse a category the journal already contains and to leave it empty otherwise — a model inventing a category on every note is exactly the sprawl the enum was protecting against, and unlike a person, it will not remember what it called things last week.

Uncategorised remains first-class. Making someone classify a thought before writing it down is still a good way to stop them writing it down.
