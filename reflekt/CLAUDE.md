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

0. **Every new feature gets its own happy-path test, and that recording is what
   goes in the PR.** One feature, one flow, one file. Do not bolt new steps onto
   an existing feature's test to avoid writing a new one — a happy path is the
   shortest believable story of that feature working, and a reviewer should be
   able to watch exactly one thing per recording.
1. Every user-facing flow has an integration test in `integration_test/`, named
   by the convention below.
2. That test captures its own frames via `Reel.shoot()` / `Reel.hold()`.
3. `scripts/record_evidence.sh` runs the test and writes both an MP4 and an
   animated GIF into `evidence/`.
4. Both are **committed**. Embed the **GIF** in the PR body with normal image
   syntax so it animates inline, and link the MP4 for full quality:

   ```md
   ![happy flow](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/reflekt/evidence/happy-flow.gif)
   ```

   A `<video>` tag does **not** work in a PR body — GitHub's sanitizer strips the
   tag entirely, and `raw.githubusercontent.com` serves `.mp4` as
   `application/octet-stream` with `nosniff`, so it would not play even if the
   tag survived. Inline video players only come from GitHub's own attachment
   upload, which needs a browser session and is not scriptable. Images route
   through GitHub's camo proxy with a real content-type, so a GIF is the only
   thing that actually animates in a PR description.
5. **The recording is produced by a passing test.** The script refuses to emit a
   video if the test fails, so a video in a PR always means the flow genuinely
   ran green. Never hand-record, trim, or otherwise doctor an evidence file — the
   whole point is that it cannot be faked.
6. Keep videos short (seconds, not minutes). They live in git forever.

### Naming convention (enforced)

```
integration_test/<feature>_test.dart  ->  evidence/<feature>.gif + <feature>.mp4
```

Underscores in the test name become dashes in the evidence name, e.g.
`integration_test/note_search_test.dart` → `evidence/note-search.gif`.
`scripts/check_evidence.sh` enforces this mapping in both directions: a flow
without committed evidence fails, and evidence without a matching test fails
too — otherwise a video implies a flow is covered when nothing verifies it.

### Running it

```bash
scripts/record_evidence.sh                # record every flow
scripts/record_evidence.sh note_search    # record one flow
scripts/check_evidence.sh                 # verify the contract before pushing

EVIDENCE_HEADLESS=0 scripts/record_evidence.sh   # watch it run in a real window
```

### What CI enforces

`.github/workflows/reflekt-evidence.yml` runs on every PR touching `reflekt/`.
It runs `flutter analyze`, `flutter test`, `check_evidence.sh`, and then
**re-records every flow from scratch**. That last step is the point: it proves
the flows actually pass at this commit, rather than trusting whatever video
happened to be committed. Evidence is uploaded as an artifact even when the job
fails, because a failed run is exactly when you need the frames and step trace.

Passing CI is not a substitute for embedding the GIF in the PR body. CI proves
it works; the GIF is what lets a human *see* it without leaving the page.

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
- **Headless Chrome is forced through a `CHROME_EXECUTABLE` shim.** Two obvious
  approaches both fail *silently*: `flutter drive --headless` does not touch the
  browser (flutter_tools launches its own Chrome to host the app and the flag
  never reaches it), and `--web-browser-flag` does not reach that launch either
  — in a failure log, compare the `Command used to launch it:` line and note
  that none of those flags appear. flutter_tools does honour
  `CHROME_EXECUTABLE`, so the script writes a shim that forces
  `--headless=new`. On a dev machine Chrome finds the compositor regardless, so
  breaking this is invisible locally and only shows up as CI dying with
  `Missing X server or $DISPLAY`.
- **To test anything display-related, unset `XDG_RUNTIME_DIR` too:**

  ```bash
  env -u DISPLAY -u WAYLAND_DISPLAY -u XDG_RUNTIME_DIR scripts/record_evidence.sh
  ```

  Unsetting only `DISPLAY` and `WAYLAND_DISPLAY` is **not** a faithful CI
  simulation — Chrome's ozone layer still finds the compositor through
  `XDG_RUNTIME_DIR`, so a broken headless setup will appear to pass.
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

## Adding a new feature — the required loop

Every feature follows this. There is no path to a PR that skips it.

1. Add `integration_test/<feature>_test.dart`, following `happy_flow_test.dart`.
   One feature, one happy path.
2. Give every widget the test touches a stable `Key` in a `...Keys` class next to
   the widget. Renaming a key breaks the recording.
3. Build the test around a `Reel`: `hold()` where a reviewer needs to read the
   screen, `shoot()` for single moments.
4. `scripts/record_evidence.sh <feature>`.
5. **Watch the GIF yourself.** A green test with a broken recording is not
   evidence — the first working version of this pipeline produced a perfectly
   "successful" all-black video. Open the file and look at it.
6. `scripts/check_evidence.sh`, then commit `evidence/<feature>.gif` and `.mp4`.
7. Embed the GIF in the PR body.

## Commands

```bash
flutter analyze                # must be clean
flutter test                   # unit + widget tests
scripts/record_evidence.sh     # E2E + evidence recording
scripts/check_evidence.sh      # evidence contract (CI runs this too)
```

## Code style

Standard Dart/Flutter conventions, `flutter_lints`. Keep `flutter analyze`
clean — it is not advisory.
