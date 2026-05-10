#!/usr/bin/env bash
set -euo pipefail

HELPERS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWHS="${PWHS:-node $HELPERS_DIR/../dist/pwhs.js}"
SERVER="${SERVER:-node $HELPERS_DIR/../dist/cli.js}"

assert_pass=0
assert_fail=0

cleanup_all_sessions() {
  $PWHS down --all >/dev/null 2>&1 || true
}

start_session() {
  PORT=$($PWHS up "$@")
  trap cleanup_all_sessions EXIT
  export PWHS_PORT=$PORT
}

start_session_via_server_log() {
  local log; log=$(mktemp)
  $SERVER > "$log" 2>&1 &
  local pid=$!
  trap "kill $pid 2>/dev/null || true; rm -f \"$log\"" EXIT
  until grep -q "Browser initialized" "$log" 2>/dev/null; do sleep 0.5; done
  PORT=$(grep -oE "localhost:[0-9]+" "$log" | head -1 | cut -d: -f2)
}

section() {
  echo ""
  echo "=== $* ==="
}

pwhs_play_heredoc() {
  $PWHS play "$(cat)"
}

curl_call() {
  local label=$1; shift
  echo "--- $label ---"
  eval "$@"
  echo ""
}

assert_contains() {
  local label=$1; shift
  local pattern=$1; shift
  local out
  out=$("$@" 2>&1 || true)
  if echo "$out" | grep -qF -- "$pattern"; then
    echo "  pass: $label"
    assert_pass=$((assert_pass + 1))
  else
    echo "  FAIL: $label — expected '$pattern' in output:"
    echo "$out" | sed 's/^/      /'
    assert_fail=$((assert_fail + 1))
  fi
}

assert_fails_with() {
  local label=$1; shift
  local pattern=$1; shift
  local out rc
  set +e
  out=$("$@" 2>&1)
  rc=$?
  set -e
  if [ "$rc" = "0" ]; then
    echo "  FAIL: $label — expected non-zero exit"
    assert_fail=$((assert_fail + 1))
    return
  fi
  if echo "$out" | grep -qF -- "$pattern"; then
    echo "  pass: $label (exit $rc)"
    assert_pass=$((assert_pass + 1))
  else
    echo "  FAIL: $label — expected '$pattern' in output:"
    echo "$out" | sed 's/^/      /'
    assert_fail=$((assert_fail + 1))
  fi
}

assert_ok() {
  local label=$1; shift
  if "$@" >/dev/null 2>&1; then
    echo "  pass: $label"
    assert_pass=$((assert_pass + 1))
  else
    echo "  FAIL: $label — non-zero exit"
    assert_fail=$((assert_fail + 1))
  fi
}

print_summary_and_exit() {
  echo ""
  echo "=== summary ==="
  echo "  pass: $assert_pass"
  echo "  fail: $assert_fail"
  if [ "$assert_fail" -gt 0 ]; then
    echo "FAIL"
    exit 1
  fi
  echo "OK"
}
