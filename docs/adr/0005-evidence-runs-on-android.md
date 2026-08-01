---
status: accepted
---

# Evidence recordings run on an Android emulator, not the web build

The spec tests double as the evidence recordings (see `reflekt/CLAUDE.md`), and
they originally ran on Chrome because no Android tooling was installed. That was
tenable while the app was a UI shell, but persistence (ADR-0002) breaks it:
SQLCipher is a native library with no `sqlite3.wasm` equivalent, so a web-hosted
spec cannot exercise encrypted storage at all. Keeping evidence on the web would
have meant proving persistence while proving nothing about encryption — the
product's central privacy claim — and shipping a storage path no spec ever ran.

So the evidence pipeline moves to an Android emulator, the platform the app
actually ships on (ADR-0001).

## Consequences

Recording gets **simpler**, not harder. Most of the web pipeline was working
around the browser: `adb shell screenrecord` produces an MP4 directly, so the
WebDriver frame-capture, the ffmpeg stitching, `chromedriver`, the
`CHROME_EXECUTABLE` headless shim, and the `--browser-dimension` viewport
workaround all become unnecessary. Screen size comes from the AVD, so evidence is
phone-shaped by construction rather than by emulation flags.

The costs are real: the Android SDK and a system image are a multi-GB install,
the emulator needs KVM, and runs are slower than headless Chrome. CI needs an
emulator action rather than a browser.

The web build survives only as a fast local sanity check (`flutter run -d
chrome`). It is not a spec surface, and it is still never shipped.
