---
status: accepted
---

# v1 sync scope: Google Drive backup only, defer E2E multi-device sync

Spec 007 gave the PWA bidirectional E2E encrypted multi-device sync via a Cloudflare Workers/D1/R2 backend, with custom client-side crypto. Porting that to Flutter would require the Dart crypto implementation to be byte-for-byte interoperable with the PWA's JS implementation — real work in service of a bridge that matters less over time as the PWA drifts toward deprecation (ADR-0001). Flutter v1 instead ports the simpler, already-existing Google Drive backup feature (client-only, no backend required): one-way encrypted backup/restore to the user's own `appDataFolder`. Full multi-device sync is deferred to a later phase, decoupled from any requirement to match the PWA's crypto format.
