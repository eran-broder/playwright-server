#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TESTS=(
  "00-quickstart.sh"
  "10-curl.sh"
  "20-multi-session.sh"
  "30-edge-profile.sh"
  "35-attach.sh"
  "40-playwright-script.sh"
  "45-ai-snapshot.sh"
  "50-sdk.sh"
  "55-native-extras.sh"
  "60-cli-contract.sh"
  "65-viewport-window.sh"
  "70-agent-repl.sh"
  "75-extension.sh"
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
