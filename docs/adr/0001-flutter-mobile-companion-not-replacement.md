---
status: accepted
---

# Flutter as mobile companion to the PWA, not a replacement (for now)

We're building a native Flutter app for Android to give journaling users app-store presence and deeper OS integration (biometric, notifications) the PWA can't offer, while keeping the existing React PWA live for web/desktop. This is a transitional state, not a permanent architecture: as the Flutter app matures we expect usage to drift toward it and may deprecate the PWA later, but v1 does not build for that end-state yet. Flutter v1 targets **Android only**; the Web build target exists purely for local dev/testing convenience (`flutter run -d chrome`) and is never shipped; iOS is deferred (no signing infra in place).

Consequences: no requirement, for now, that the Flutter and PWA clients interoperate at the data layer — see ADR-0004.
