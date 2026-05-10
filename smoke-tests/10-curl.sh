#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

start_session_via_server_log
BASE="http://localhost:$PORT"
echo "server up on :$PORT"

curl_call "POST /navigate" \
  "curl -s -X POST '$BASE/navigate' \
    -H 'Content-Type: application/json' \
    -d '{\"url\": \"https://example.com\"}'"

curl_call "GET /url" \
  "curl -s '$BASE/url'"

curl_call "GET /title" \
  "curl -s '$BASE/title'"

curl_call "GET /snapshot" \
  "curl -s '$BASE/snapshot'"

curl_call "POST /execute/inline (expression)" \
  "curl -s -X POST '$BASE/execute/inline' \
    -H 'Content-Type: application/json' \
    -d '{\"code\": \"document.querySelectorAll(\\\"a\\\").length\"}'"

curl_call "POST /screenshot" \
  "curl -s -X POST '$BASE/screenshot' \
    -H 'Content-Type: application/json' \
    -d '{\"name\": \"curl-shot\"}'"

curl_call "GET /activity/poll?since=0 (first 600 chars)" \
  "curl -s '$BASE/activity/poll?since=0' | head -c 600"

curl_call "POST /script/execute-playwright (full Playwright API)" \
  "curl -s -X POST '$BASE/script/execute-playwright' \
    -H 'Content-Type: application/json' \
    -d '{\"code\": \"const cookies = await context.cookies(); return cookies.length;\"}'"

curl_call "GET /status" \
  "curl -s '$BASE/status'"

echo "OK — curl"
