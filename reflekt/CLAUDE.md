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

**The E2E test IS the specification.** There is no separate spec document, and
adding one would be a mistake — a spec that is not executed drifts from the code
the moment either changes.

A feature is specified by `integration_test/<feature>_test.dart`: a `SPEC —`
header stating the intent and what is deliberately out of scope, then the
scenario in **Given / When / Then**. Running it proves the spec and produces the
video, so specification, verification, and evidence are one artefact.

```dart
await spec.given("today's journal has nothing written in it", () async {
  expect(find.byKey(JournalHomeKeys.emptyState), findsOneWidget);
});

await spec.when('the composer is opened', () async {
  await spec.tap(find.byKey(JournalHomeKeys.addNote));
});

await spec.then('an empty note is offered to write in', () async {
  expect(find.byKey(NoteComposerKeys.field), findsOneWidget);
});

await spec.and('saving is refused while nothing has been written', () async {
  expect(saveButton(spec).onPressed, isNull);
});
```

**`when` acts and never asserts; `then` asserts and never acts.** Keep that
split — the moment a `when` block contains an `expect`, the spec stops saying
which behaviour is actually under test. Use `and` to continue the preceding
keyword rather than repeating it.

**Every PR ships that test and an MP4 of it running.** A reviewer must be able to
open the PR and *watch the feature work* without checking anything out. A PR that
changes behaviour and has no updated recording is not ready for review.

### The rules

0. **Every new feature gets its own spec test, and that recording is what goes
   in the PR.** One feature, one flow, one file. Do not bolt new steps onto an
   existing feature's test to avoid writing a new one — a happy path is the
   shortest believable story of that feature working, and a reviewer should be
   able to watch exactly one thing per recording.
1. Every user-facing flow has a spec test in `integration_test/`, named by the
   convention below.
2. Tests are written against the `_spec.dart` harness, which captures frames
   automatically. A test body contains behaviour, never recording calls.
3. `scripts/record_evidence.sh` runs the test and writes both an MP4 and an
   animated GIF into `evidence/`.
4. Both are **committed**. Embed the **GIF** in the PR body with normal image
   syntax so it animates inline, and link the MP4 for full quality:

   ```md
   ![journal a note](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/reflekt/evidence/journal-a-note.gif)
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

### Naming convention

```
integration_test/<feature>_test.dart  ->  evidence/<feature>.gif + <feature>.mp4
```

Underscores in the test name become dashes in the evidence name, e.g.
`integration_test/note_search_test.dart` → `evidence/note-search.gif`.
`scripts/record_evidence.sh` derives the output names from this mapping, so a
test file and its evidence always line up.

Nothing checks this automatically — keeping evidence present and current is a
review-time responsibility.

### Running it

```bash
scripts/record_evidence.sh                # record every flow
scripts/record_evidence.sh note_search    # record one flow

```

The emulator boots headless and is shut down afterwards, unless one was already
running — in which case the script reuses it, which is much faster while
iterating. To watch a run, start the emulator yourself first:

```bash
$ANDROID_HOME/emulator/emulator -avd reflekt-evidence &
```

Recordings are the emulator's screen, so they are phone-shaped by construction —
no viewport emulation involved. Change the shape by recreating the AVD with
different `EVIDENCE_LCD_*` values.

### What CI does

Two workflows, split by cost:

- **`reflekt-checks.yml` — automatic** on every PR touching `reflekt/`. Runs
  `flutter analyze` and `flutter test`. It does not record anything, so it is
  quick.
- **`reflekt-evidence.yml` — manual only** (`workflow_dispatch`). Records the
  videos. Recording needs an emulator and several minutes, so it runs on demand:

  ```bash
  gh workflow run reflekt-evidence.yml --ref <branch>
  gh workflow run reflekt-evidence.yml --ref <branch> -f flow=note_search
  ```

  Dispatch by **filename**, not by display name — `gh` resolves display names
  against the default branch, so `gh workflow run "Reflekt evidence (manual)"`
  fails with *"could not find any workflows named …"* whenever the name differs
  from (or does not yet exist on) `master`. For the same reason, a
  `workflow_dispatch` trigger added on a feature branch only becomes available
  once that workflow file has landed on the default branch.

  It uploads the results as an artifact; download it, commit the files, and
  embed the GIF. For local work `scripts/record_evidence.sh` is faster.

Note the trade-off this accepts: nothing automated checks evidence at all — not
that it exists, not that it matches the current code. Recording after changing a
flow, and noticing when a PR arrives without a video, are both on the humans
reviewing it.

Passing checks is not a substitute for embedding the GIF in the PR body. The
GIF is what lets a human *see* it without leaving the page.

### One-time setup

`ffmpeg`, a JDK 17+, and the Android SDK. Then:

```bash
scripts/setup_android.sh    # creates the AVD recordings run on
```

The emulator needs KVM or it is unusably slow:

```bash
sudo setfacl -m u:$USER:rw /dev/kvm     # this session, takes effect immediately
sudo usermod -aG kvm $USER              # permanent, needs a re-login
```

`setup_android.sh` creates the AVD at **1080x1920**, overriding the device
profile's taller screen: 9:16 keeps the GIF a sensible height in a PR body,
where a true 9:20 phone is mostly dead space in this app.

## Constraints that are NOT arbitrary

Each of these cost real debugging time. Changing one will silently break the
evidence pipeline, usually without a useful error message.

- **Recording starts when the app launches, not when the script does.** A cold
  Gradle build runs longer than `screenrecord`'s 180s limit, so starting the
  recording up front spends it entirely on the build and yields a video of an
  idle home screen with the spec nowhere in it. The script polls
  `adb shell pidof com.aijournaling.reflekt` and only then starts recording.
- **Stop `screenrecord` with SIGINT.** `adb shell pkill -INT screenrecord` lets
  it finalise the MP4 container. Killing it outright leaves a file that exists,
  has a plausible size, and will not play.
- **`adb wait-for-device` is not "ready".** It returns as soon as adb can talk
  to the device, long before Android can install anything. Poll
  `getprop sys.boot_completed` or the first `flutter drive` races the boot and
  fails with a confusing install error.
- **Run in `--profile`, not debug.** Debug builds carry the observatory and
  service extensions that make timings unrepresentative of what ships.
- **Never use `pumpAndSettle` once a text field has focus.** The cursor blinks
  forever, so the tree never settles and `pumpAndSettle` times out. The harness
  paces with `_hold()` instead.
- **Scripts use `grep`, not `ripgrep`.** A committed script must not depend on a
  tool that a CI runner or a colleague's machine may not have.

## Adding a new feature — the required loop

Every feature follows this. There is no path to a PR that skips it.

1. Add `integration_test/<feature>_test.dart`, following
   `journal_a_note_test.dart`. One feature, one happy path.
2. Open with a `SPEC —` doc comment: the feature name, its intent in a sentence,
   and an explicit "deliberately out of scope" list so absent behaviour is not
   mistaken for a gap.
3. Write the scenario as `spec.given` / `spec.when` / `spec.then` / `spec.and`.
   Each description completes its keyword as a sentence — it is a line of the
   specification, so write it for a human, not as a machine slug. Use
   `spec.tap` / `spec.type` for interaction and plain `expect` for assertions;
   the harness handles recording. Keep `when` free of assertions.
4. Give every widget the test touches a stable `Key` in a `...Keys` class next to
   the widget. Renaming a key breaks the recording.
5. `scripts/record_evidence.sh <feature>`.
6. **Watch the GIF yourself.** A green test with a broken recording is not
   evidence — the first working version of this pipeline produced a perfectly
   "successful" all-black video. Open the file and look at it.
7. Commit `evidence/<feature>.gif` and `.mp4`.
8. Embed the GIF in the PR body.

## Commands

```bash
flutter analyze                # must be clean
flutter test                   # unit + widget tests
scripts/record_evidence.sh     # E2E + evidence recording
```

## Code style

Standard Dart/Flutter conventions, `flutter_lints`. Keep `flutter analyze`
clean — it is not advisory.
