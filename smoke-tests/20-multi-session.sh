#!/usr/bin/env bash
# 20-multi-session.sh — spawn N independent servers, drive each separately,
# tear them all down. Demonstrates the no-default port-selection model and
# the session registry.
#
# Run from repo root:  bash smoke-tests/20-multi-session.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWHS="${PWHS:-node $SCRIPT_DIR/../dist/pwhs.js}"

# Spawn three servers. Each gets its own OS-picked port and tempdir.
P1=$($PWHS up); echo "server A on :$P1"
P2=$($PWHS up); echo "server B on :$P2"
P3=$($PWHS up); echo "server C on :$P3"

trap "$PWHS down --all >/dev/null 2>&1 || true" EXIT

# `pwhs ls` reads ~/.local/state/pwhs/sessions.json (or %LOCALAPPDATA% on
# Windows), prunes dead pids, prints the live ones.
echo ""
echo "--- pwhs ls ---"
$PWHS ls

# With multiple servers up, no default — every verb must say which port
# it wants. This call would error:
echo ""
echo "--- pwhs status with no port selected (intentional error) ---"
$PWHS status 2>&1 || true

# Drive each server to a different URL — concurrent, no interference.
echo ""
echo "--- driving each session to a different URL ---"
$PWHS -p $P1 nav https://example.com
$PWHS -p $P2 nav https://example.org
$PWHS -p $P3 nav https://example.net

echo ""
echo "--- each session's current URL ---"
echo "A: $($PWHS -p $P1 url)"
echo "B: $($PWHS -p $P2 url)"
echo "C: $($PWHS -p $P3 url)"

# $PWHS_PORT is sticky for the shell — useful when most calls go to one
# session and only a few hit the others.
export PWHS_PORT=$P2
echo ""
echo "title via PWHS_PORT (B): $($PWHS title)"
echo "title via -p flag  (A): $($PWHS -p $P1 title)"

echo ""
echo "OK — multi-session smoke test passed."
