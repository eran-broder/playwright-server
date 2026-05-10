#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

trap cleanup_all_sessions EXIT

P1=$($PWHS up); echo "server A on :$P1"
P2=$($PWHS up); echo "server B on :$P2"
P3=$($PWHS up); echo "server C on :$P3"

section "pwhs ls"
$PWHS ls

section "pwhs status with no port selected (intentional error)"
$PWHS status 2>&1 || true

section "drive each session to a different URL"
$PWHS -p $P1 nav https://example.com
$PWHS -p $P2 nav https://example.org
$PWHS -p $P3 nav https://example.net

section "each session's current URL"
echo "A: $($PWHS -p $P1 url)"
echo "B: $($PWHS -p $P2 url)"
echo "C: $($PWHS -p $P3 url)"

export PWHS_PORT=$P2
echo ""
echo "title via PWHS_PORT (B): $($PWHS title)"
echo "title via -p flag  (A): $($PWHS -p $P1 title)"

echo ""
echo "OK — multi-session"
