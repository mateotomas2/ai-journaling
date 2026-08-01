#!/usr/bin/env bash
#
# Records the happy-flow integration test to an MP4 that gets attached to a PR.
# This is the evidence system described in CLAUDE.md — every PR ships one.
#
# Frames are captured through WebDriver (Chrome's own renderer), not by grabbing
# the screen. That matters: x11grab captures nothing under Wayland, because
# XWayland windows never composite into the X root window. Going through
# WebDriver makes the recording independent of the compositor, and lets the
# whole thing run headless in CI.
#
# Usage:
#   scripts/record_evidence.sh [output-name]
#
# Produces: evidence/<output-name>.mp4  (default name: happy-flow)
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

OUT_NAME="${1:-happy-flow}"
OUT_DIR="$PROJECT_ROOT/evidence"
FRAME_DIR="$OUT_DIR/frames"
OUT_FILE="$OUT_DIR/${OUT_NAME}.mp4"
GIF_FILE="$OUT_DIR/${OUT_NAME}.gif"

TARGET="${EVIDENCE_TARGET:-integration_test/happy_flow_test.dart}"
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
}
trap cleanup EXIT

# --- preflight -------------------------------------------------------------
command -v chromedriver >/dev/null || fail "chromedriver not on PATH. See CLAUDE.md > Evidence system."
command -v ffmpeg       >/dev/null || fail "ffmpeg not on PATH."
command -v "$FLUTTER"   >/dev/null || fail "flutter not on PATH (override with FLUTTER_BIN)."
[[ -f "$TARGET" ]]      || fail "test target not found: $TARGET"

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

# --- drive -----------------------------------------------------------------
# Profile mode is deliberate: debug mode cannot attach its debug service to
# Chrome here (dwds throws AppConnectionException).
HEADLESS_FLAG="--no-headless"
[[ "$HEADLESS" == "1" ]] && HEADLESS_FLAG="--headless"

log "driving $TARGET (headless=$HEADLESS)"
set +e
"$FLUTTER" drive \
  --driver=test_driver/integration_test.dart \
  --target="$TARGET" \
  -d chrome \
  --browser-name=chrome \
  --driver-port="$DRIVER_PORT" \
  "$HEADLESS_FLAG" \
  --profile \
  --web-browser-flag="--hide-scrollbars"
DRIVE_STATUS=$?
set -e

if [[ $DRIVE_STATUS -ne 0 ]]; then
  fail "integration test FAILED (exit $DRIVE_STATUS) — no evidence produced. Check the REPORT_DATA line above for the step trace."
fi

# --- stitch ----------------------------------------------------------------
shopt -s nullglob
FRAMES=("$FRAME_DIR"/f*.png)
FRAME_COUNT=${#FRAMES[@]}
[[ "$FRAME_COUNT" -gt 0 ]] || fail "no frames captured in $FRAME_DIR"
log "stitching $FRAME_COUNT frames at ${FPS}fps"

# yuv420p needs even dimensions, hence the scale filter.
ffmpeg -nostdin -loglevel error -y \
  -framerate "$FPS" -pattern_type glob -i "$FRAME_DIR/f*.png" \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 -preset veryslow -crf 28 -pix_fmt yuv420p \
  -movflags +faststart "$OUT_FILE"

# A GIF as well as the MP4, because GitHub cannot show an inline video player in
# a PR body: its sanitizer strips <video> outright, and raw.githubusercontent
# serves .mp4 as application/octet-stream with nosniff so it would not play
# anyway. Images go through GitHub's camo proxy with a real content-type, so a
# GIF is the only thing that actually animates in the PR description.
log "building inline GIF"
PALETTE="$(mktemp -t reflekt-palette-XXXXXX.png)"
GIF_FILTER="fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos"
ffmpeg -nostdin -loglevel error -y -i "$OUT_FILE" \
  -vf "${GIF_FILTER},palettegen=stats_mode=diff" "$PALETTE"
ffmpeg -nostdin -loglevel error -y -i "$OUT_FILE" -i "$PALETTE" \
  -lavfi "${GIF_FILTER}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
  "$GIF_FILE"
rm -f "$PALETTE"

rm -rf "$FRAME_DIR"

log "done: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1), ${FRAME_COUNT} frames)"
log "done: $GIF_FILE ($(du -h "$GIF_FILE" | cut -f1)) — embed this one in the PR body"
