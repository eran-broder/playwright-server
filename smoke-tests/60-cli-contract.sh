#!/usr/bin/env bash
# 60-cli-contract.sh — assert the CLI contract for both `pwhs` and
# `playwright-http-server`: help text, error paths/exit codes, flag
# parsing, and at least one invocation of every pwhs verb.
#
# Run from repo root:  bash smoke-tests/60-cli-contract.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWHS="${PWHS:-node $SCRIPT_DIR/../dist/pwhs.js}"
SERVER="${SERVER:-node $SCRIPT_DIR/../dist/cli.js}"

pass_count=0
fail_count=0

expect_contains() {
  local label=$1; shift
  local pattern=$1; shift
  local out
  out=$("$@" 2>&1 || true)
  if echo "$out" | grep -qF -- "$pattern"; then
    echo "  pass: $label"
    pass_count=$((pass_count + 1))
  else
    echo "  FAIL: $label — expected '$pattern' in output:"
    echo "$out" | sed 's/^/      /'
    fail_count=$((fail_count + 1))
  fi
}

expect_fail() {
  local label=$1; shift
  local pattern=$1; shift
  local out rc
  set +e
  out=$("$@" 2>&1)
  rc=$?
  set -e
  if [ "$rc" = "0" ]; then
    echo "  FAIL: $label — expected non-zero exit, got 0"
    fail_count=$((fail_count + 1))
    return
  fi
  if echo "$out" | grep -qF -- "$pattern"; then
    echo "  pass: $label (exit $rc, matched '$pattern')"
    pass_count=$((pass_count + 1))
  else
    echo "  FAIL: $label — expected '$pattern' in output:"
    echo "$out" | sed 's/^/      /'
    fail_count=$((fail_count + 1))
  fi
}

expect_ok() {
  local label=$1; shift
  if "$@" >/dev/null 2>&1; then
    echo "  pass: $label"
    pass_count=$((pass_count + 1))
  else
    echo "  FAIL: $label — non-zero exit"
    fail_count=$((fail_count + 1))
  fi
}

trap "$PWHS down --all >/dev/null 2>&1 || true" EXIT

echo "=== help text ==="
expect_contains "pwhs --help — Usage banner"           "Usage: pwhs"            $PWHS --help
expect_contains "pwhs --help — lists nav verb"         "pwhs nav"                $PWHS --help
expect_contains "pwhs --help — lists port selection"   "PWHS_PORT"               $PWHS --help
expect_contains "playwright-http-server --help — usage" "Usage: playwright-http-server" $SERVER --help
expect_contains "server --help — lists --browser"      "--browser"              $SERVER --help
expect_contains "server --help — lists --profile"      "--profile"              $SERVER --help

echo ""
echo "=== empty registry ==="
expect_contains "pwhs ls — no servers"                 "No servers running"     $PWHS ls
expect_fail "pwhs status — no server suggests up"      "No servers running"     $PWHS status
expect_fail "pwhs unknown verb — clear error"          "Unknown verb"           $PWHS bogus

echo ""
echo "=== server CLI flag validation ==="
expect_fail "--browser firefox — invalid"              "Invalid --browser"      $SERVER --browser firefox
expect_fail "--profile-mode bogus — invalid"           "Invalid --profile-mode" $SERVER --profile-mode bogus

echo ""
echo "=== single server: every verb ==="
PORT=$($PWHS up)
echo "  spawned :$PORT"
export PWHS_PORT=$PORT

# flag-anywhere parsing
expect_contains "flag before verb (-p N status)"       '"server": "running"'    $PWHS -p $PORT status
expect_contains "flag after verb (status -p N)"        '"server": "running"'    $PWHS status -p $PORT

# Read verbs
$PWHS nav https://example.com >/dev/null
expect_contains "url after nav"        "example.com"          $PWHS url
expect_contains "title"                "Example Domain"        $PWHS title
expect_contains "html"                 "<title>"               $PWHS html
expect_contains "snap"                 "heading"               $PWHS snap
expect_contains "snap with selector"   "Example Domain"        $PWHS snap h1

# Inject test elements that the interaction verbs can target.
$PWHS eval 'document.body.insertAdjacentHTML("beforeend", "<input id=\"si\" /><select id=\"ss\"><option value=\"v1\">A</option><option value=\"v2\">B</option></select><div id=\"ht\">x</div>")' >/dev/null

expect_ok  "click h1"                                       $PWHS click h1
expect_ok  "type into input"                                $PWHS type "#si" hello
expect_ok  "hover element"                                  $PWHS hover "#ht"
expect_ok  "select option"                                  $PWHS select "#ss" v2
expect_ok  "scroll"                                         $PWHS scroll 0 50
expect_ok  "key Tab"                                        $PWHS key Tab
expect_ok  "wait selector"                                  $PWHS wait h1 5000

# Capture
expect_contains "shot — prints filepath"  ".png"         $PWHS shot smoke-shot
expect_contains "shots — list"            "smoke-shot"   $PWHS shots

# Code execution
expect_contains "eval — expression"       "42"            $PWHS eval "21+21"
expect_contains "play — return value"     "true"          $PWHS play "return true;"

# Activity
expect_contains "poll — watermark"        "watermark"     $PWHS poll
expect_contains "check — watermark"       "watermark"     $PWHS check

# Multi-tab: open a second page, list, switch by index, switch latest.
$PWHS play 'const p = await context.newPage(); await p.goto("https://example.org"); return p.url();' >/dev/null
expect_contains "pages — list with index"  '"index": 1'   $PWHS pages
expect_ok  "latest — switch to newest tab"                 $PWHS latest
expect_ok  "switch — by index"                             $PWHS switch 0

# Browser lifecycle (stop/start/restart). Must come after capture/interaction.
expect_contains "stop"     "stopped"   $PWHS stop
expect_contains "start"    "started"   $PWHS start
expect_contains "restart"  "restarted" $PWHS restart

echo ""
echo "=== argument validation errors ==="
expect_fail "nav with no url"              "pwhs nav <url>"           $PWHS nav
expect_fail "click with no selector"       "pwhs click <selector>"    $PWHS click
expect_fail "type with no text"            "pwhs type"                $PWHS type input
expect_fail "key with no key"              "pwhs key <key>"           $PWHS key

echo ""
echo "=== multi-session ambiguity ==="
PORT2=$($PWHS up)
echo "  spawned :$PORT2"
expect_contains "ls — both ports"   "$PORT2"             $PWHS ls
unset PWHS_PORT
expect_fail "no port + 2 servers"   "Multiple servers"   $PWHS status
expect_contains "down -p N — single" "Killed"            $PWHS down -p $PORT2

echo ""
echo "=== summary ==="
echo "  pass: $pass_count"
echo "  fail: $fail_count"

if [ "$fail_count" -gt 0 ]; then
  echo "FAIL — see above"
  exit 1
fi

echo "OK — CLI contract smoke test passed."
