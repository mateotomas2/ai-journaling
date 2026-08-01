# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is **single-context**. There is no `CONTEXT-MAP.md`, and there are no
context-scoped ADR directories — one glossary and one decision log cover both
the React PWA and the Flutter app.

```
/
├── CONTEXT.md              ← domain glossary (Backup vs Sync, crypto terms)
├── docs/adr/
│   ├── 0001-flutter-mobile-companion-not-replacement.md
│   ├── 0002-drift-sqlcipher-local-storage.md
│   ├── 0003-on-device-embeddings.md
│   └── 0004-v1-sync-scope-google-drive-backup-only.md
├── src/                    ← React PWA (TypeScript)
└── reflekt/                ← Flutter app (Dart), has its own CLAUDE.md
```

Note the repo currently holds two clients for the same domain. ADR-0001 records
that the Flutter app is a mobile companion for now and the PWA is expected to
drift toward deprecation — so when the two disagree, check which one a decision
was actually written about before treating it as global.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
