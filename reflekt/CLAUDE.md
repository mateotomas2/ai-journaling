# Reflekt (Flutter) — Development Guidelines

Native Flutter client for the AI journaling app. Domain language lives in
[`../CONTEXT.md`](../CONTEXT.md); the decisions that shaped this app are in
[`../docs/adr/`](../docs/adr/) — read ADR-0001 through ADR-0004 before making
architectural changes.

## Current state

This is the foundation shell. Journal notes live **in memory only** and are lost
on restart. Local persistence (Drift + SQLCipher, ADR-0002), on-device
embeddings (ADR-0003), and Google Drive backup (ADR-0004) are not built yet.

Target platform is **Android** (ADR-0001). The web build exists only as a dev and
test surface — it is never shipped.

## The evidence system (MANDATORY)

**Every PR ships a happy-flow E2E test and an MP4 of it running.** No exceptions.
A reviewer must be able to open the PR and *watch the feature work* without
checking anything out. A PR that changes behaviour and has no updated recording
is not ready for review.

### The rules

1. Every user-facing flow has an integration test in `integration_test/`.
2. That test captures its own frames via `Reel.shoot()` / `Reel.hold()`.
3. `scripts/record_evidence.sh` runs the test and stitches an MP4 into
   `evidence/`.
4. The MP4 is **committed** and linked in the PR body. GitHub renders `.mp4`
   blobs with an inline player, and there is no scriptable API to attach a video
   to a PR body — committing it is what makes the link work.
5. **The recording is produced by a passing test.** The script refuses to emit a
   video if the test fails, so a video in a PR always means the flow genuinely
   ran green. Never hand-record, trim, or otherwise doctor an evidence file — the
   whole point is that it cannot be faked.
6. Keep videos short (seconds, not minutes). They live in git forever.

### Running it

```bash
scripts/record_evidence.sh                 # -> evidence/happy-flow.mp4
scripts/record_evidence.sh my-feature      # -> evidence/my-feature.mp4

EVIDENCE_TARGET=integration_test/other_test.dart scripts/record_evidence.sh other
EVIDENCE_HEADLESS=0 scripts/record_evidence.sh   # watch it run in a real window
```

### One-time setup

`ffmpeg` and a `chromedriver` matching your installed Chrome must be on `PATH`:

```bash
google-chrome --version   # note the version, e.g. 151.0.7922.71
# download the matching linux64 chromedriver from
# https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json
install -m755 chromedriver ~/.local/bin/chromedriver
```

## Constraints that are NOT arbitrary

Each of these cost real debugging time. Changing one will silently break the
evidence pipeline, usually without a useful error message.

- **Run in `--profile`, not debug.** In debug mode `dwds` cannot attach its debug
  service to Chrome here and throws `AppConnectionException`.
- **Never use `tester.enterText` in these tests.** On Flutter web the engine
  routes text through a hidden DOM input the test harness never reaches, so
  `enterText` leaves the controller empty and the test fails with no usable
  message. Use the `typeInto` helper, which drives
  `EditableTextState.updateEditingValue` — the same path the real platform uses.
- **Never use `pumpAndSettle` once a text field has focus.** The cursor blinks
  forever, so the tree never settles and `pumpAndSettle` times out. Use
  `Reel.hold()`.
- **Frames come from WebDriver, not a screen grab.** `ffmpeg -f x11grab` captures
  pure black on this machine: under Wayland, XWayland windows never composite
  into the X root window. GNOME's `org.gnome.Shell.Screencast` D-Bus interface
  also produced only an empty header here. Capturing through WebDriver means the
  recording does not depend on the compositor and runs headless in CI.
- **The driver sets `writeResponseOnFailure: true`.** It defaults to `false`,
  which drops diagnostics on exactly the runs that need them. Web profile builds
  strip `debugPrint` and report empty assertion details, so without this a failed
  run tells you nothing at all.
- **Tests report a step trace through `binding.reportData`.** That trace is the
  only debugging channel that survives a web profile build. When a run fails,
  read the `REPORT_DATA` line — it shows the last step reached and the error.

## Adding a new flow

1. Add `integration_test/<name>_test.dart`, following `happy_flow_test.dart`.
2. Give every widget the test touches a stable `Key` in a `...Keys` class next to
   the widget. Renaming a key breaks the recording.
3. Build the test around a `Reel`: `hold()` where a reviewer needs to read the
   screen, `shoot()` for single moments.
4. Record it, watch the MP4 yourself, then attach it to the PR.

## Commands

```bash
flutter analyze                # must be clean
flutter test                   # unit + widget tests
scripts/record_evidence.sh     # E2E + evidence recording
```

## Code style

Standard Dart/Flutter conventions, `flutter_lints`. Keep `flutter analyze`
clean — it is not advisory.
