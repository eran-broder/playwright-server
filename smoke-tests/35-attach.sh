#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

DBG_PORT=19233
start_host_browser --debug-port "$DBG_PORT"

section "wait for host browser CDP endpoint"
for _ in $(seq 1 60); do
  curl -fsS "http://localhost:$DBG_PORT/json/version" >/dev/null 2>&1 && break
  sleep 0.5
done
assert_ok "host browser exposes CDP" curl -fsS "http://localhost:$DBG_PORT/json/version"

section "attach to running browser"
PORT=$($PWHS up --attach $DBG_PORT)
export PWHS_PORT=$PORT
assert_contains "status reports attached mode" '"mode": "attached"' $PWHS status
assert_contains "adopts existing host tab" "host-tab" $PWHS title

section "drive the attached browser"
$PWHS nav 'data:text/html,<title>via-attach</title><h1>navigated</h1>' >/dev/null
assert_contains "navigation over attach" "via-attach" $PWHS title
assert_contains "snapshot over attach" "navigated" $PWHS snap

section "stop disconnects without killing the host browser"
$PWHS stop >/dev/null
assert_ok "host browser still alive" curl -fsS "http://localhost:$DBG_PORT/json/version"

print_summary_and_exit
