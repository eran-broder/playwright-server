#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

start_session

PAGE='data:text/html,<title>refs-page</title><button onclick="this.textContent=String(99)">press</button><a href="data:text/plain,hi" download="hi.txt">save</a>'
$PWHS nav "$PAGE"

section "ai snapshot includes refs"
SNAP=$($PWHS snap --ai)
echo "$SNAP"
assert_contains "snapshot has [ref=" "[ref=" echo "$SNAP"

section "click by aria-ref"
REF=$(echo "$SNAP" | grep -oE 'button "press" \[ref=e[0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
echo "button ref: $REF"
assert_ok "click aria-ref=$REF" $PWHS click "aria-ref=$REF"
assert_contains "button reacted" "99" $PWHS eval 'document.querySelector("button").textContent'

section "history: back / forward / reload"
$PWHS nav 'data:text/html,<title>second</title><h1>two</h1>' >/dev/null
$PWHS back >/dev/null
assert_contains "back lands on refs-page" "refs-page" $PWHS title
$PWHS forward >/dev/null
assert_contains "forward lands on second" "second" $PWHS title
$PWHS reload >/dev/null
assert_contains "reload keeps page" "second" $PWHS title

section "download captured in activity log"
$PWHS back >/dev/null
$PWHS click 'text=save'
sleep 1
assert_contains "download entry recorded" "suggestedFilename" $PWHS poll

print_summary_and_exit
