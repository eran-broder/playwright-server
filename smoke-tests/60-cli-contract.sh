#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

trap cleanup_all_sessions EXIT

section "help text"
assert_contains "pwhs --help — Usage banner"          "Usage: pwhs"                   $PWHS --help
assert_contains "pwhs --help — lists nav verb"        "pwhs nav"                      $PWHS --help
assert_contains "pwhs --help — lists port selection"  "PWHS_PORT"                     $PWHS --help
assert_contains "pwhs --help — lists cdp verb"        "pwhs cdp"                      $PWHS --help
assert_contains "pwhs --help — lists trace verb"      "pwhs trace"                    $PWHS --help
assert_contains "server --help — usage"               "Usage: playwright-http-server" $SERVER --help
assert_contains "server --help — lists --browser"     "--browser"                     $SERVER --help
assert_contains "server --help — lists --profile"     "--profile"                     $SERVER --help
assert_contains "server --help — lists --attach"      "--attach"                      $SERVER --help

section "empty registry"
assert_contains  "pwhs ls — no servers"            "No servers running"   $PWHS ls
assert_fails_with "pwhs status — no server"        "No servers running"   $PWHS status
assert_fails_with "pwhs unknown verb"              "Unknown verb"         $PWHS bogus

section "server CLI flag validation"
assert_fails_with "--browser firefox — invalid"        "Invalid --browser"      $SERVER --browser firefox
assert_fails_with "--profile-mode bogus — invalid"     "Invalid --profile-mode" $SERVER --profile-mode bogus

section "single server: every verb"
start_session
echo "  spawned :$PORT"

assert_contains "flag before verb (-p N status)"  '"server": "running"'  $PWHS -p $PORT status
assert_contains "flag after verb (status -p N)"   '"server": "running"'  $PWHS status -p $PORT

$PWHS nav https://example.com >/dev/null
assert_contains "url after nav"        "example.com"     $PWHS url
assert_contains "title"                "Example Domain"  $PWHS title
assert_contains "html"                 "<title>"         $PWHS html
assert_contains "snap"                 "heading"         $PWHS snap
assert_contains "snap with selector"   "Example Domain"  $PWHS snap h1

$PWHS eval 'document.body.insertAdjacentHTML("beforeend", "<input id=\"si\" /><select id=\"ss\"><option value=\"v1\">A</option><option value=\"v2\">B</option></select><div id=\"ht\">x</div>")' >/dev/null

assert_ok "click h1"          $PWHS click h1
assert_ok "type into input"   $PWHS type "#si" hello
assert_ok "hover element"     $PWHS hover "#ht"
assert_ok "select option"     $PWHS select "#ss" v2
assert_ok "scroll"            $PWHS scroll 0 50
assert_ok "key Tab"           $PWHS key Tab
assert_ok "wait selector"     $PWHS wait h1 5000

assert_contains "shot — prints filepath"  ".png"        $PWHS shot smoke-shot
assert_contains "shots — list"            "smoke-shot"  $PWHS shots

assert_contains "eval — expression"       "42"          $PWHS eval "21+21"
assert_contains "play — return value"     "true"        $PWHS play "return true;"

assert_contains "poll — watermark"        "watermark"   $PWHS poll
assert_contains "check — watermark"       "watermark"   $PWHS check

$PWHS play 'const p = await context.newPage(); await p.goto("https://example.org"); return p.url();' >/dev/null
assert_contains "pages — list with index"  '"index": 1'  $PWHS pages
assert_ok       "latest — switch to newest tab"          $PWHS latest
assert_ok       "switch — by index"                      $PWHS switch 0

assert_contains "snap --ai — includes refs"  "[ref="  $PWHS snap --ai

$PWHS nav https://example.org load >/dev/null
assert_contains "back — prior url"     "example.com"  $PWHS back
assert_contains "forward — next url"   "example.org"  $PWHS forward
assert_contains "reload — same url"    "example.org"  $PWHS reload

assert_contains "cdp — Browser.getVersion"  "product"  $PWHS cdp Browser.getVersion

assert_ok       "trace start"                $PWHS trace start
assert_contains "trace stop — zip path"      ".zip"     $PWHS trace stop

assert_ok       "clock set"                  $PWHS clock set 1700000000000
assert_contains "clock — Date.now frozen"    "1700000000000"  $PWHS eval "Date.now()"

assert_contains "stop"     "stopped"     $PWHS stop
assert_contains "start"    "started"     $PWHS start
assert_contains "restart"  "restarted"   $PWHS restart

section "argument validation errors"
assert_fails_with "nav with no url"           "pwhs nav <url>"         $PWHS nav
assert_fails_with "click with no selector"    "pwhs click <selector>"  $PWHS click
assert_fails_with "type with no text"         "pwhs type"              $PWHS type input
assert_fails_with "key with no key"           "pwhs key <key>"         $PWHS key
assert_fails_with "cdp with no method"        "pwhs cdp <method>"      $PWHS cdp
assert_fails_with "trace with bogus arg"      "pwhs trace <start|stop>" $PWHS trace bogus
assert_fails_with "clock with bogus arg"      "pwhs clock"             $PWHS clock bogus
assert_fails_with "clock set with no value"   "pwhs clock set"         $PWHS clock set

section "multi-session ambiguity"
PORT2=$($PWHS up)
echo "  spawned :$PORT2"
assert_contains "ls — both ports"       "$PORT2"             $PWHS ls
unset PWHS_PORT
assert_fails_with "no port + 2 servers" "Multiple servers"   $PWHS status
assert_contains "down -p N — single"    "Killed"             $PWHS down -p $PORT2

print_summary_and_exit
