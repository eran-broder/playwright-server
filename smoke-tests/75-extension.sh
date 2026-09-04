#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

section "host browser with the pwhs extension"
start_host_browser --token "$($PWHS token)" --label smoke
assert_contains "host browser ready" "READY" cat "$HOST_LOG"
section "pwhs up --extension"
PORT=$($PWHS up --extension --profile smoke)
export PWHS_PORT=$PORT
SERVER_LOG=$($PWHS status | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).logFile))")
echo "server log: $SERVER_LOG"
assert_contains "status reports extension mode" '"mode": "extension"' $PWHS status
assert_contains "status reports the profile" '"profile": "smoke"' $PWHS status
assert_contains "adopts the host tab" "host-tab" $PWHS title

section "profiles catalog"
assert_contains "profiles lists the paired label" '"label": "smoke"' $PWHS profiles
assert_contains "profiles lists the host tab" "host-tab" $PWHS profiles

PAGE='data:text/html,<title>refs-page</title><button onclick="this.textContent=String(99)">press</button><a href="data:text/plain,hi" download="hi.txt">save</a>'
section "navigate, ai snapshot, click by ref, eval"
$PWHS nav "$PAGE" >/dev/null
SNAP=$($PWHS snap --ai)
assert_contains "snapshot has refs" "[ref=" echo "$SNAP"
REF=$(echo "$SNAP" | grep -oE 'button "press" \[ref=e[0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
assert_ok "click aria-ref=$REF" $PWHS click "aria-ref=$REF"
assert_contains "button reacted" "99" $PWHS eval 'document.querySelector("button").textContent'
assert_contains "history back/forward" "refs-page" bash -c "$PWHS nav 'data:text/html,<title>two</title>' >/dev/null; $PWHS back >/dev/null; $PWHS title"

section "screenshot and activity"
assert_contains "screenshot written" ".png" $PWHS shot ext-shot
assert_contains "activity captured navigation" "navigation" $PWHS poll 0

section "new tab via playwright, pages, switch, latest"
assert_contains "context.newPage works" "second-tab" $PWHS play "const p = await context.newPage(); await p.goto('data:text/html,<title>second-tab</title><h1>2</h1>'); return await p.title();"
assert_contains "pages lists every tab with ids" "tabId" $PWHS pages
assert_contains "pages sees the new tab" "second-tab" $PWHS pages
$PWHS latest >/dev/null
assert_contains "latest switches to newest tab" "second-tab" $PWHS title
$PWHS switch 0 >/dev/null
assert_contains "switch 0 returns to the first tab" "refs-page" $PWHS title

section "raw CDP"
assert_contains "Browser.getVersion is synthesized" "product" $PWHS cdp Browser.getVersion
assert_contains "Runtime.evaluate passes through" "refs-page" $PWHS cdp Runtime.evaluate '{"expression":"document.title"}'

section "window bounds through Browser.* translation"
NARROW=$($PWHS play "
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: 640, height: 600 } });
  await page.waitForFunction(() => window.outerWidth < 700, null, { timeout: 5000 }).catch(() => {});
  return await page.evaluate(() => window.outerWidth < 700);
")
assert_contains "window resized via extension" "true" echo "$NARROW"

section "tracing and clock"
assert_ok "trace start" $PWHS trace start
$PWHS reload >/dev/null
TRACE_PATH=$($PWHS trace stop | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).path))")
assert_ok "trace file exists" test -s "$TRACE_PATH"
assert_ok "clock set" $PWHS clock set 1700000000000
assert_contains "Date.now() is fixed" "1700000000000" $PWHS eval 'Date.now()'

section "download surfaces in the activity log"
WATERMARK=$($PWHS check | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).watermark))")
$PWHS click 'text=save'
sleep 2
assert_contains "download entry recorded" "suggestedFilename" $PWHS poll "$WATERMARK"

section "restart onto a specific tab, stop keeps the browser alive"
TAB=$($PWHS pages | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const t=JSON.parse(s).find(p=>p.title==='second-tab');console.log(t.tabId)})")
$PWHS restart tab="$TAB" >/dev/null
assert_contains "restart adopted tab $TAB" "second-tab" $PWHS title
$PWHS stop >/dev/null
assert_ok "host browser still running after stop" kill -0 $HOST_PID
$PWHS start profile=smoke >/dev/null
assert_contains "start reconnects" '"mode": "extension"' $PWHS status

section "device emulation is rejected in extension mode"
assert_fails_with "device rejected" "not available in extension mode" $PWHS restart "iPhone 14"

print_summary_and_exit
