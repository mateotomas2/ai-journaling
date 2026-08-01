#!/usr/bin/env bash
#
# Records the spec tests to the evidence files attached to a PR.
# This is the evidence system described in CLAUDE.md — every PR ships one.
#
# Runs on an Android emulator (ADR-0005), the platform the app ships on, so a
# recording exercises the real storage stack including SQLCipher. `adb shell
# screenrecord` captures the video on-device, which is why this needs none of
# the browser machinery the web pipeline did.
#
# Convention:
#   integration_test/<feature>_test.dart  ->  evidence/<feature>.gif + .mp4
#   (underscores in the test name become dashes in the evidence name)
#
# Usage:
#   scripts/record_evidence.sh                 # record every flow
#   scripts/record_evidence.sh persist_notes   # record one flow
#
# First time: scripts/setup_android.sh
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk}"
export ANDROID_HOME JAVA_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$JAVA_HOME/bin:$PATH"

OUT_DIR="$PROJECT_ROOT/evidence"
AVD_NAME="${EVIDENCE_AVD:-reflekt-evidence}"
FPS="${EVIDENCE_FPS:-12}"
GIF_WIDTH="${EVIDENCE_GIF_WIDTH:-360}"
BIT_RATE="${EVIDENCE_BIT_RATE:-4000000}"
FLUTTER="${FLUTTER_BIN:-flutter}"
DEVICE_MP4=/sdcard/reflekt-evidence.mp4
APP_ID="${EVIDENCE_APP_ID:-com.aijournaling.reflekt}"

EMULATOR_PID=""
STARTED_EMULATOR=0

log()  { printf '\033[1;34m[evidence]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[evidence]\033[0m %s\n' "$*" >&2; exit 1; }

cleanup() {
  adb shell pkill -INT screenrecord >/dev/null 2>&1 || true
  if [[ "$STARTED_EMULATOR" == "1" && -n "$EMULATOR_PID" ]]; then
    log "shutting down the emulator this run started"
    adb emu kill >/dev/null 2>&1 || kill "$EMULATOR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# --- preflight -------------------------------------------------------------
command -v adb        >/dev/null || fail "adb not found under $ANDROID_HOME/platform-tools — run scripts/setup_android.sh"
command -v ffmpeg     >/dev/null || fail "ffmpeg not on PATH."
command -v "$FLUTTER" >/dev/null || fail "flutter not on PATH (override with FLUTTER_BIN)."

shopt -s nullglob
if [[ $# -gt 0 ]]; then
  TARGETS=("integration_test/${1%_test.dart}_test.dart")
  [[ -f "${TARGETS[0]}" ]] || fail "no such test: ${TARGETS[0]}"
else
  TARGETS=(integration_test/*_test.dart)
  [[ ${#TARGETS[@]} -gt 0 ]] || fail "no spec tests found in integration_test/"
fi

mkdir -p "$OUT_DIR"

# --- device ----------------------------------------------------------------
adb start-server >/dev/null 2>&1 || true

if ! adb devices | grep -Eq "emulator-[0-9]+[[:space:]]+device"; then
  command -v emulator >/dev/null || fail "no emulator running and the emulator binary is missing — run scripts/setup_android.sh"
  log "booting AVD '$AVD_NAME' (headless)"
  emulator -avd "$AVD_NAME" -no-window -no-audio -no-boot-anim -no-snapshot \
    -gpu swiftshader_indirect >/dev/null 2>&1 &
  EMULATOR_PID=$!
  STARTED_EMULATOR=1

  adb wait-for-device
  # wait-for-device returns as soon as adb can talk to it, which is long before
  # Android is usable; poll for boot completion or the first `flutter drive`
  # races the boot and fails with a confusing install error.
  for _ in $(seq 1 180); do
    [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]] && break
    sleep 2
  done
  [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]] \
    || fail "emulator did not finish booting"
  adb shell input keyevent 82 >/dev/null 2>&1 || true
else
  log "using the emulator already running"
fi

DEVICE_ID="$(adb devices | grep -Eo "emulator-[0-9]+" | head -1)"
[[ -n "$DEVICE_ID" ]] || fail "no emulator device found"
log "device: $DEVICE_ID ($(adb shell getprop ro.build.version.release | tr -d '\r'))"

record_one() {
  local target="$1"
  local base name mp4 gif palette gif_filter
  base="$(basename "$target" _test.dart)"
  name="${base//_/-}"
  mp4="$OUT_DIR/${name}.mp4"
  gif="$OUT_DIR/${name}.gif"

  adb shell rm -f "$DEVICE_MP4" >/dev/null 2>&1 || true

  # Build and install first, unrecorded. Starting the recording before this
  # would spend it on the Gradle build — which on a cold cache runs longer than
  # screenrecord's limit, so the video would expire before the spec even began
  # and capture nothing but an idle home screen.
  log "driving $target (recording starts when the app launches)"
  local drive_log status_file
  drive_log="$(mktemp -t reflekt-drive-XXXXXX.log)"
  status_file="$(mktemp -t reflekt-drive-XXXXXX.status)"

  (
    # `set +e` is load-bearing. Under the inherited `set -e`, a failing
    # `flutter drive` terminates this subshell on the spot and the status is
    # never written — leaving an empty file that reads as success, so a failing
    # spec would still produce evidence.
    set +e
    "$FLUTTER" drive \
      --driver=test_driver/integration_test.dart \
      --target="$target" \
      -d "$DEVICE_ID" \
      --profile >"$drive_log" 2>&1
    echo $? >"$status_file"
  ) &
  local drive_pid=$!

  local rec_pid=""
  for _ in $(seq 1 900); do
    if adb shell pidof "$APP_ID" >/dev/null 2>&1; then
      adb shell screenrecord --bit-rate "$BIT_RATE" --time-limit 180 \
        "$DEVICE_MP4" &
      rec_pid=$!
      log "app is up — recording"
      break
    fi
    kill -0 "$drive_pid" 2>/dev/null || break
    sleep 1
  done

  wait "$drive_pid" 2>/dev/null || true
  local status
  status="$(cat "$status_file" 2>/dev/null || true)"
  # Absent or unparseable means the run died before reporting. Treat anything
  # that is not an explicit success as failure — never the other way round, or
  # a crashed run ships evidence of nothing.
  [[ "$status" =~ ^[0-9]+$ ]] || status=1
  cat "$drive_log"
  rm -f "$drive_log" "$status_file"

  # SIGINT so screenrecord finalises the container; killing it outright leaves
  # an unplayable file.
  adb shell pkill -INT screenrecord >/dev/null 2>&1 || true
  [[ -n "$rec_pid" ]] && { wait "$rec_pid" 2>/dev/null || true; }
  sleep 2

  [[ -n "$rec_pid" ]] || fail "the app never started, so nothing was recorded — see the drive output above"

  if [[ $status -ne 0 ]]; then
    fail "spec FAILED: $target — no evidence produced. Read the REPORT_DATA line above; 'failedAt' names the clause that stopped holding."
  fi

  adb pull "$DEVICE_MP4" "$mp4" >/dev/null 2>&1 \
    || fail "could not pull the recording off the device"
  adb shell rm -f "$DEVICE_MP4" >/dev/null 2>&1 || true
  [[ -s "$mp4" ]] || fail "recording is empty for $target"

  # A GIF as well as the MP4, because GitHub cannot show an inline video player
  # in a PR body: its sanitizer strips <video> outright, and
  # raw.githubusercontent serves .mp4 as application/octet-stream with nosniff
  # so it would not play anyway. Images go through GitHub's camo proxy with a
  # real content-type, so a GIF is the only thing that animates in a PR body.
  log "building inline GIF"
  palette="$(mktemp -t reflekt-palette-XXXXXX.png)"
  gif_filter="fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos"
  ffmpeg -nostdin -loglevel error -y -i "$mp4" \
    -vf "${gif_filter},palettegen=stats_mode=diff" "$palette"
  ffmpeg -nostdin -loglevel error -y -i "$mp4" -i "$palette" \
    -lavfi "${gif_filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
    "$gif"
  rm -f "$palette"

  log "done: $(basename "$gif") ($(du -h "$gif" | cut -f1)) — embed this in the PR body"
}

for target in "${TARGETS[@]}"; do
  record_one "$target"
done

log "recorded ${#TARGETS[@]} flow(s)"
