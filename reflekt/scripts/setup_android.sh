#!/usr/bin/env bash
#
# One-time local setup for the evidence emulator (ADR-0005).
#
# Creates the AVD that spec recordings run on. Safe to re-run; it does nothing
# if the AVD already exists.
#
# Requires the Android SDK. If you do not have one:
#   https://developer.android.com/studio#command-tools  (cmdline-tools)
# and a JDK 17+. Point ANDROID_HOME / JAVA_HOME at them.
#
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk}"
export ANDROID_HOME JAVA_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$JAVA_HOME/bin:$PATH"

AVD_NAME="${EVIDENCE_AVD:-reflekt-evidence}"
SYSTEM_IMAGE="${EVIDENCE_SYSTEM_IMAGE:-system-images;android-36;google_apis;x86_64}"

# 9:16 rather than a modern phone's 9:20. A true tall-phone recording makes an
# awkwardly tall GIF in a PR body and the extra height is dead space in this app.
LCD_WIDTH="${EVIDENCE_LCD_WIDTH:-1080}"
LCD_HEIGHT="${EVIDENCE_LCD_HEIGHT:-1920}"
LCD_DENSITY="${EVIDENCE_LCD_DENSITY:-420}"

log()  { printf '\033[1;34m[android-setup]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[android-setup]\033[0m %s\n' "$*" >&2; exit 1; }

command -v avdmanager >/dev/null || fail "avdmanager not found under $ANDROID_HOME/cmdline-tools/latest/bin"
command -v emulator   >/dev/null || fail "emulator not found — install the 'emulator' SDK package"

if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  fail "no read/write access to /dev/kvm — the emulator would be unusably slow.
  Grant it for this session:   sudo setfacl -m u:\$USER:rw /dev/kvm
  Or permanently:              sudo usermod -aG kvm \$USER   (then log out and back in)"
fi

if avdmanager list avd 2>/dev/null | grep -Eq "^[[:space:]]*Name: ${AVD_NAME}$"; then
  log "AVD '$AVD_NAME' already exists — nothing to do"
  exit 0
fi

log "installing $SYSTEM_IMAGE (if missing)"
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager "$SYSTEM_IMAGE" "platform-tools" "emulator" >/dev/null

log "creating AVD '$AVD_NAME'"
echo "no" | avdmanager create avd \
  --name "$AVD_NAME" \
  --package "$SYSTEM_IMAGE" \
  --device "pixel_6" \
  --force >/dev/null

CONFIG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"
[[ -f "$CONFIG" ]] || fail "expected AVD config at $CONFIG"

# Override the device profile's screen so recordings come out 9:16, and disable
# the boot animation and snapshots so runs start from a predictable state.
{
  echo "hw.lcd.width=$LCD_WIDTH"
  echo "hw.lcd.height=$LCD_HEIGHT"
  echo "hw.lcd.density=$LCD_DENSITY"
  echo "hw.keyboard=yes"
  echo "disk.dataPartition.size=2G"
} >> "$CONFIG"

log "done: AVD '$AVD_NAME' at ${LCD_WIDTH}x${LCD_HEIGHT}"
log "record with: scripts/record_evidence.sh"
