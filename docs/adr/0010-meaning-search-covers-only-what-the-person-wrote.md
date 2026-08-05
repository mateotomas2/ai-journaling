---
status: accepted
---

# Meaning search covers only what the person wrote

Once a day holds a chat as well as notes, the meaning index has to decide what a "memory" is. It covers notes and the person's own messages, and never the assistant's replies — an assistant reply is largely a restatement of the entries it was built from, so indexing it returns the machine paraphrasing you, ranked above the thing you actually wrote, and feeds derived text back into the corpus that the next question retrieves from.

## Consequences

"What did the AI tell me about my sleep?" will not surface through meaning search. Plain text search over messages is the only route to it, and that gap is deliberate — expect it to arrive as a bug report.

It also roughly halves the on-device embedding work, which matters because ADR-0003 puts that work on the phone.

Note what this is *not*: the assistant's replies are still stored, still encrypted, still shown, still part of the conversation the model is given. They are simply not memories.
