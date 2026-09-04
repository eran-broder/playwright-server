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

kill_tree() {
  local pid=$1
  [ -n "$pid" ] || return 0
  if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
    taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
  else
    kill "$pid" 2>/dev/null || true
  fi
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

start_host_browser() {
  HOST_LOG=$(mktemp)
  (cd "$HELPERS_DIR/.." && npx --no-install ts-node "$HELPERS_DIR/_host-browser.ts" "$@" > "$HOST_LOG" 2>&1) &
  HOST_PID=$!
  trap cleanup_host_browser EXIT
  for _ in $(seq 1 120); do
    grep -q "READY" "$HOST_LOG" 2>/dev/null && return 0
    if ! kill -0 $HOST_PID 2>/dev/null; then cat "$HOST_LOG"; exit 1; fi
    sleep 0.5
  done
  echo "host browser did not become ready"; cat "$HOST_LOG"; exit 1
}

cleanup_host_browser() {
  cleanup_all_sessions
  kill_tree "$(grep -oE 'BROWSER_PID=[0-9]+' "$HOST_LOG" 2>/dev/null | cut -d= -f2)"
  kill_tree "$HOST_PID"
  if [ "${KEEP_HOST_LOG:-}" = "1" ]; then echo "host log kept: $HOST_LOG"; else rm -f "$HOST_LOG"; fi
}
