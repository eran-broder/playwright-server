#!/usr/bin/env bash
# 00-quickstart.sh — minimal end-to-end run via the pwhs CLI.
# Spawns a fresh server, drives it through every common verb, cleans up.
#
# Run from repo root:  bash smoke-tests/00-quickstart.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWHS="${PWHS:-node $SCRIPT_DIR/../dist/pwhs.js}"

# Spin up a server in the background. `pwhs up` returns once the server has
# registered itself in ~/.local/state/pwhs/sessions.json (or %LOCALAPPDATA%
# on Windows) and is ready to receive requests.
PORT=$($PWHS up)
trap "$PWHS down -p $PORT >/dev/null 2>&1 || true" EXIT
echo "server up on :$PORT (pid recorded in sessions registry)"

# Every verb takes -p <port> or reads $PWHS_PORT. The latter is sticky for
# the rest of this script.
export PWHS_PORT=$PORT

# Navigate. /navigate uses waitUntil:networkidle.
$PWHS nav https://example.com

# Read-only inspection. These verbs unwrap the JSON to a single value.
echo "url:   $($PWHS url)"
echo "title: $($PWHS title)"

# Compact accessibility tree (YAML-style). 2–5 KB vs ~100 KB raw HTML.
echo "--- snapshot ---"
$PWHS snap | head -10

# Page-context JS. Body is an *expression*, not a function body.
echo "links on page: $($PWHS eval "document.querySelectorAll('a').length")"

# Take a screenshot; the verb prints just the filepath.
SHOT=$($PWHS shot quickstart-shot)
echo "screenshot: $SHOT"

# Activity log: every network request, console message, page error,
# navigation, and dialog gets an incrementing id. since=0 returns all.
echo "--- activity (counts by type) ---"
$PWHS poll 0 | python -c 'import json,sys; d=json.load(sys.stdin); print(d.get("summary", {}))' 2>/dev/null \
  || $PWHS poll 0 | head -30

echo ""
echo "OK — quickstart smoke test passed."
