#!/usr/bin/env bash
#
# Enforces the evidence contract from CLAUDE.md:
#
#   * every feature has a happy-flow integration test
#   * every integration test has committed evidence a reviewer can watch
#
# Mapping (same rule as scripts/record_evidence.sh):
#   integration_test/<feature>_test.dart -> evidence/<feature>.gif + .mp4
#
# Run locally before opening a PR; CI runs it too.
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
bad()  { printf '\033[1;31m  ✗\033[0m %s\n' "$*"; }
log()  { printf '\033[1;34m[evidence-check]\033[0m %s\n' "$*"; }

shopt -s nullglob
TESTS=(integration_test/*_test.dart)
PROBLEMS=0

if [[ ${#TESTS[@]} -eq 0 ]]; then
  bad "no integration tests found in integration_test/"
  echo
  echo "Every feature needs a happy-flow test. See CLAUDE.md > Evidence system."
  exit 1
fi

log "checking ${#TESTS[@]} flow(s)"

for test in "${TESTS[@]}"; do
  base="$(basename "$test" _test.dart)"
  name="${base//_/-}"
  gif="evidence/${name}.gif"
  mp4="evidence/${name}.mp4"

  for artefact in "$gif" "$mp4"; do
    if [[ ! -f "$artefact" ]]; then
      bad "$test -> missing $artefact"
      PROBLEMS=$((PROBLEMS + 1))
      continue
    fi
    # An empty or near-empty file means a broken recording, not evidence.
    if [[ $(stat -c%s "$artefact") -lt 1024 ]]; then
      bad "$artefact is suspiciously small — did the recording actually capture anything?"
      PROBLEMS=$((PROBLEMS + 1))
      continue
    fi
    if ! git ls-files --error-unmatch "$artefact" >/dev/null 2>&1; then
      bad "$artefact exists but is not committed — the PR would have no evidence"
      PROBLEMS=$((PROBLEMS + 1))
      continue
    fi
    ok "$artefact"
  done
done

# Evidence with no matching test is dead weight, and worse, it implies a flow is
# covered when nothing verifies it.
for artefact in evidence/*.gif; do
  name="$(basename "$artefact" .gif)"
  test="integration_test/${name//-/_}_test.dart"
  if [[ ! -f "$test" ]]; then
    bad "$artefact has no matching $test — evidence must come from a real test"
    PROBLEMS=$((PROBLEMS + 1))
  fi
done

echo
if [[ $PROBLEMS -gt 0 ]]; then
  bad "$PROBLEMS problem(s)"
  echo
  echo "Fix by recording the missing flows:"
  echo "  scripts/record_evidence.sh"
  echo "then commit the files in evidence/."
  exit 1
fi

log "evidence contract satisfied"
