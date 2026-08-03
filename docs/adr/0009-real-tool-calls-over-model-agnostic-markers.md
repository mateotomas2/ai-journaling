---
status: accepted
---

# Real tool calls, and a model list restricted to models that support them

`OpenRouterAi` originally pulled a requested note out of the reply by parsing a fenced ` ```note ` block, explicitly so the feature would work across every model OpenRouter offers regardless of tool support. That reasoning is now overturned: the marker is one-way, so it can express "save this text" but can never carry a tool *result* back into the conversation, which makes reading notes, searching the journal, updating and deleting impossible to build on it. Reflekt uses real `tool_calls` and restricts the curated model list to models that support them.

## Consequences

The model list stops being a matter of taste and becomes a constraint that has to be maintained — a model that cannot call tools cannot be offered, however good it is at prose.

The prompt loses its note-block instructions, and `_readAnswer` goes with them. If a future reader finds marker parsing reappearing as a "compatibility" fallback, that is this decision being quietly reversed: two paths for the same capability means the tool path stops being tested against the models that matter.

`JournalAi` becomes a streaming contract rather than `Future<Answer>`, so every spec fake in `integration_test/` implements the new shape. That is a large one-off cost paid on purpose, and it lands in the chat PR rather than being spread across several.
