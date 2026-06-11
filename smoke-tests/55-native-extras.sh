#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

start_session

$PWHS nav 'data:text/html,<title>extras</title><h1>x</h1>'

section "raw CDP passthrough"
assert_contains "cdp Browser.getVersion" "product" $PWHS cdp Browser.getVersion
assert_contains "cdp with params" "extras" $PWHS cdp Runtime.evaluate '{"expression":"document.title"}'

section "playwright tracing"
assert_ok "trace start" $PWHS trace start
$PWHS nav 'data:text/html,<title>traced</title><h1>t</h1>' >/dev/null
TRACE_OUT=$($PWHS trace stop)
echo "$TRACE_OUT"
assert_contains "trace stop returns zip path" ".zip" echo "$TRACE_OUT"
TRACE_PATH=$(echo "$TRACE_OUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).path)})")
assert_ok "trace file exists" test -s "$TRACE_PATH"

section "clock control"
assert_ok "clock set fixed time" $PWHS clock set 1700000000000
assert_contains "Date.now() is fixed" "1700000000000" $PWHS eval 'Date.now()'
assert_ok "clock install" $PWHS clock install 1700000000000
assert_ok "clock fast-forward" $PWHS clock ff 60000
assert_contains "Date.now() advanced by >=60s" "true" $PWHS eval 'Date.now() >= 1700000060000 && Date.now() < 1700000120000'

print_summary_and_exit
