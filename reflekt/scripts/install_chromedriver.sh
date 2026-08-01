#!/usr/bin/env bash
#
# Installs a chromedriver matching the Chrome that chromedriver will actually
# launch, resolved at run time from Chrome for Testing.
#
# Why this exists: a mismatched pair fails with
#   "session not created: This version of ChromeDriver only supports Chrome
#    version N. Current browser version is M"
# and pinning a version in CI just moves the breakage to whenever the runner
# image updates Chrome. Resolving at run time is self-correcting.
#
# Note this must match the *default* Chrome on the box, not necessarily
# $CHROME_EXECUTABLE: chromedriver spawns its own browser for the WebDriver
# session and does not read that variable.
#
# Usage:
#   scripts/install_chromedriver.sh [install-dir]     # default: ~/.local/bin
#
set -euo pipefail

INSTALL_DIR="${1:-$HOME/.local/bin}"
ENDPOINT="https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json"

log()  { printf '\033[1;34m[chromedriver]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[chromedriver]\033[0m %s\n' "$*" >&2; exit 1; }

CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null; then
    CHROME="$(command -v "$candidate")"
    break
  fi
done
[[ -n "$CHROME" ]] || fail "no Chrome found on PATH"

CHROME_VERSION="$("$CHROME" --version | grep -oE '[0-9]+(\.[0-9]+){3}' | head -1)"
[[ -n "$CHROME_VERSION" ]] || fail "could not parse version from: $("$CHROME" --version)"
log "chrome $CHROME_VERSION ($CHROME)"

if command -v chromedriver >/dev/null; then
  HAVE="$(chromedriver --version | grep -oE '[0-9]+(\.[0-9]+){3}' | head -1 || true)"
  if [[ "${HAVE%%.*}" == "${CHROME_VERSION%%.*}" ]]; then
    log "chromedriver $HAVE already matches milestone ${CHROME_VERSION%%.*} — nothing to do"
    exit 0
  fi
  log "chromedriver $HAVE does not match chrome $CHROME_VERSION, replacing"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "resolving download"
curl -sSfL "$ENDPOINT" -o "$TMP/versions.json"

URL="$(python3 - "$TMP/versions.json" "$CHROME_VERSION" <<'PY'
import json, sys

data = json.load(open(sys.argv[1]))
wanted = sys.argv[2]
milestone = wanted.split('.')[0]

def driver_url(entry):
    for d in entry.get('downloads', {}).get('chromedriver', []):
        if d['platform'] == 'linux64':
            return d['url']
    return None

# Prefer the exact build; otherwise the newest build of the same milestone,
# which is wire-compatible.
exact = [v for v in data['versions'] if v['version'] == wanted]
same  = [v for v in data['versions'] if v['version'].split('.')[0] == milestone]

for pool in (exact, same):
    for entry in reversed(pool):
        url = driver_url(entry)
        if url:
            print(url)
            sys.exit(0)
sys.exit(1)
PY
)" || fail "no linux64 chromedriver published for chrome $CHROME_VERSION"

log "downloading $URL"
curl -sSfL "$URL" -o "$TMP/chromedriver.zip"
unzip -oq "$TMP/chromedriver.zip" -d "$TMP"

BINARY="$(find "$TMP" -type f -name chromedriver | head -1)"
[[ -n "$BINARY" ]] || fail "chromedriver binary not found in archive"

mkdir -p "$INSTALL_DIR"
install -m755 "$BINARY" "$INSTALL_DIR/chromedriver"
log "installed -> $INSTALL_DIR/chromedriver ($("$INSTALL_DIR/chromedriver" --version))"
