#!/usr/bin/env bash
# run-all.sh — execute every smoke test in order. Prints a summary at the end.
#
# Run from repo root:  bash smoke-tests/run-all.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TESTS=(
  "00-quickstart.sh"
  "10-curl.sh"
  "20-multi-session.sh"
  "30-edge-profile.sh"
  "40-playwright-script.sh"
  "50-sdk.sh"
  "60-cli-contract.sh"
)

pass=()
fail=()

for t in "${TESTS[@]}"; do
  echo ""
  echo "===================================================================="
  echo "running: $t"
  echo "===================================================================="
  if bash "$SCRIPT_DIR/$t"; then
    pass+=("$t")
  else
    fail+=("$t")
  fi
done

echo ""
echo "===================================================================="
echo "SUMMARY"
echo "===================================================================="
echo "passed (${#pass[@]}): ${pass[*]:-none}"
echo "failed (${#fail[@]}): ${fail[*]:-none}"

if [ "${#fail[@]}" -gt 0 ]; then
  exit 1
fi
