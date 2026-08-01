---
status: accepted
---

# Local storage: Drift (SQLite) + SQLCipher, not Isar

The PWA stores data in RxDB over encrypted IndexedDB, with no direct Flutter equivalent. We picked **Drift (SQLite) with SQLCipher** for encryption at rest, over **Isar** (NoSQL, closer to RxDB's document-store feel), because the domain (`Day` → `Message` / `Summary` / `Note`, keyed by `dayId`) is already relational-shaped even though RxDB stores it as documents, and SQLCipher's encryption story is more mature and proven than Isar's.

Considered options: Isar (rejected — weaker encryption maturity), Hive (rejected — no encryption comparable in strength to SQLCipher).
