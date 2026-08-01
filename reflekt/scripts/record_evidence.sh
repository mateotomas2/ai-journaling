#!/usr/bin/env bash
#
# Records happy-flow integration tests to the evidence files attached to a PR.
# This is the evidence system described in CLAUDE.md — every PR ships one.
#
# Convention (enforced by scripts/check_evidence.sh):
#   integration_test/<feature>_test.dart  ->  evidence/<feature>.gif + .mp4
#   (underscores in the test name become dashes in the evidence name)
#
# Frames are captured through WebDriver (Chrome's own renderer), not by grabbing
# the screen. That matters: x11grab captures nothing under Wayland, because
# XWayland windows never composite into the X root window. Going through
# WebDriver makes the recording independent of the compositor, and lets the
# whole thing run headless in CI.
#
# Usage:
#   scripts/record_evidence.sh              # record every flow
#   scripts/record_evidence.sh happy_flow   # record one flow
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

OUT_DIR="$PROJECT_ROOT/evidence"
FRAME_DIR="$OUT_DIR/frames"

DRIVER_PORT="${EVIDENCE_DRIVER_PORT:-4444}"
FPS="${EVIDENCE_FPS:-5}"
GIF_WIDTH="${EVIDENCE_GIF_WIDTH:-900}"
HEADLESS="${EVIDENCE_HEADLESS:-1}"
FLUTTER="${FLUTTER_BIN:-flutter}"

CHROMEDRIVER_PID=""

log()  { printf '\033[1;34m[evidence]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[evidence]\033[0m %s\n' "$*" >&2; exit 1; }

cleanup() {
  [[ -n "$CHROMEDRIVER_PID" ]] && kill "$CHROMEDRIVER_PID" 2>/dev/null || true
  rm -rf "$FRAME_DIR"
}
trap cleanup EXIT

# --- preflight -------------------------------------------------------------
command -v chromedriver >/dev/null || fail "chromedriver not on PATH. See CLAUDE.md > Evidence system."
command -v ffmpeg       >/dev/null || fail "ffmpeg not on PATH."
command -v "$FLUTTER"   >/dev/null || fail "flutter not on PATH (override with FLUTTER_BIN)."

shopt -s nullglob
if [[ $# -gt 0 ]]; then
  TARGETS=("integration_test/${1%_test.dart}_test.dart")
  [[ -f "${TARGETS[0]}" ]] || fail "no such test: ${TARGETS[0]}"
else
  TARGETS=(integration_test/*_test.dart)
  [[ ${#TARGETS[@]} -gt 0 ]] || fail "no integration tests found in integration_test/"
fi

mkdir -p "$OUT_DIR"

# --- chromedriver ----------------------------------------------------------
log "starting chromedriver on :$DRIVER_PORT"
chromedriver --port="$DRIVER_PORT" >/dev/null 2>&1 &
CHROMEDRIVER_PID=$!

for _ in $(seq 1 30); do
  curl -sf "http://localhost:$DRIVER_PORT/status" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "http://localhost:$DRIVER_PORT/status" >/dev/null 2>&1 \
  || fail "chromedriver did not come up on :$DRIVER_PORT"

# `flutter drive --headless` does NOT make the browser headless: flutter_tools
# launches its own Chrome to host the app and that flag never reaches it, so on
# a machine with no X server Chrome dies with "Missing X server or $DISPLAY".
# Headlessness has to be handed to the browser itself.
BROWSER_FLAGS=(--web-browser-flag="--hide-scrollbars")
if [[ "$HEADLESS" == "1" ]]; then
  BROWSER_FLAGS+=(--web-browser-flag="--headless=new")
  BROWSER_FLAGS+=(--web-browser-flag="--no-sandbox")
  BROWSER_FLAGS+=(--web-browser-flag="--disable-dev-shm-usage")
fi

record_one() {
  local target="$1"
  local base name mp4 gif palette gif_filter frames frame_count
  base="$(basename "$target" _test.dart)"
  name="${base//_/-}"
  mp4="$OUT_DIR/${name}.mp4"
  gif="$OUT_DIR/${name}.gif"

  # Profile mode is deliberate: debug mode cannot attach its debug service to
  # Chrome here (dwds throws AppConnectionException).
  log "driving $target (headless=$HEADLESS)"
  if ! "$FLUTTER" drive \
      --driver=test_driver/integration_test.dart \
      --target="$target" \
      -d chrome \
      --browser-name=chrome \
      --driver-port="$DRIVER_PORT" \
      --profile \
      "${BROWSER_FLAGS[@]}"; then
    fail "integration test FAILED: $target — no evidence produced. Read the REPORT_DATA line above for the step trace."
  fi

  frames=("$FRAME_DIR"/f*.png)
  frame_count=${#frames[@]}
  [[ "$frame_count" -gt 0 ]] || fail "no frames captured for $target — does the test use Reel.shoot()/hold()?"

  log "stitching $frame_count frames at ${FPS}fps -> $(basename "$mp4")"
  # yuv420p needs even dimensions, hence the scale filter.
  ffmpeg -nostdin -loglevel error -y \
    -framerate "$FPS" -pattern_type glob -i "$FRAME_DIR/f*.png" \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -c:v libx264 -preset veryslow -crf 28 -pix_fmt yuv420p \
    -movflags +faststart "$mp4"

  # A GIF as well as the MP4, because GitHub cannot show an inline video player
  # in a PR body: its sanitizer strips <video> outright, and
  # raw.githubusercontent serves .mp4 as application/octet-stream with nosniff
  # so it would not play anyway. Images go through GitHub's camo proxy with a
  # real content-type, so a GIF is the only thing that animates in a PR body.
  palette="$(mktemp -t reflekt-palette-XXXXXX.png)"
  gif_filter="fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos"
  ffmpeg -nostdin -loglevel error -y -i "$mp4" \
    -vf "${gif_filter},palettegen=stats_mode=diff" "$palette"
  ffmpeg -nostdin -loglevel error -y -i "$mp4" -i "$palette" \
    -lavfi "${gif_filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
    "$gif"
  rm -f "$palette"

  rm -rf "$FRAME_DIR"
  log "done: $(basename "$gif") ($(du -h "$gif" | cut -f1)) — embed this in the PR body"
}

for target in "${TARGETS[@]}"; do
  record_one "$target"
done

log "recorded ${#TARGETS[@]} flow(s)"
