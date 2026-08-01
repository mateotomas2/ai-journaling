<!--
Reflekt PRs must ship evidence. See reflekt/CLAUDE.md > Evidence system.
Delete the Evidence section only if this PR touches no app behaviour.
-->

## What changed

<!-- One or two sentences. Why, not just what. -->

## 📹 Evidence

<!--
Embed the GIF so it animates inline. A <video> tag does NOT work here:
GitHub's sanitizer strips it, and raw.githubusercontent serves .mp4 as
application/octet-stream with nosniff so it would not play anyway.

![<feature>](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/reflekt/evidence/<feature>.gif)
-->

- [ ] Every feature in this PR has a happy-flow test in `integration_test/`
- [ ] `scripts/record_evidence.sh` was run and the recording is committed
- [ ] The GIF is embedded above and I watched it myself
- [ ] `scripts/check_evidence.sh` passes

## Checks

- [ ] `flutter analyze` clean
- [ ] `flutter test` passes

## Notes for the reviewer

<!-- Anything non-obvious: trade-offs, deferred work, ADRs touched. -->
