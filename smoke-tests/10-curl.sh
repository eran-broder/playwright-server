#!/usr/bin/env bash
# 10-curl.sh — same flow as 00-quickstart, using curl against the HTTP API.
# Useful as a reference for clients that aren't using pwhs.
#
# Responses are shown raw so you can see exactly what the API returns.
# All POSTs use Content-Type: application/json.
#
# Run from repo root:  bash smoke-tests/10-curl.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="${SERVER:-node $SCRIPT_DIR/../dist/cli.js}"

LOG=$(mktemp)
$SERVER > "$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -f "$LOG"' EXIT

until grep -q "Browser initialized" "$LOG" 2>/dev/null; do sleep 0.5; done
PORT=$(grep -oE "localhost:[0-9]+" "$LOG" | head -1 | cut -d: -f2)
BASE="http://localhost:$PORT"
echo "server up on :$PORT"
echo ""

show() { echo "--- $1 ---"; eval "$2"; echo; echo; }

show "POST /navigate" \
  "curl -s -X POST '$BASE/navigate' \
    -H 'Content-Type: application/json' \
    -d '{\"url\": \"https://example.com\"}'"

show "GET /url" \
  "curl -s '$BASE/url'"

show "GET /title" \
  "curl -s '$BASE/title'"

show "GET /snapshot (accessibility tree, JSON-escaped string)" \
  "curl -s '$BASE/snapshot'"

show "POST /execute/inline (expression — no top-level return)" \
  "curl -s -X POST '$BASE/execute/inline' \
    -H 'Content-Type: application/json' \
    -d '{\"code\": \"document.querySelectorAll(\\\"a\\\").length\"}'"

show "POST /screenshot" \
  "curl -s -X POST '$BASE/screenshot' \
    -H 'Content-Type: application/json' \
    -d '{\"name\": \"curl-shot\"}'"

show "GET /activity/poll?since=0 (first 600 chars)" \
  "curl -s '$BASE/activity/poll?since=0' | head -c 600"

show "POST /script/execute-playwright (full Playwright API; can use return)" \
  "curl -s -X POST '$BASE/script/execute-playwright' \
    -H 'Content-Type: application/json' \
    -d '{\"code\": \"const cookies = await context.cookies(); return cookies.length;\"}'"

show "GET /status" \
  "curl -s '$BASE/status'"

echo "OK — curl smoke test passed."
