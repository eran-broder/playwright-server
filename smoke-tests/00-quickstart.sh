#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

start_session
echo "server up on :$PORT"

$PWHS nav https://example.com

echo "url:   $($PWHS url)"
echo "title: $($PWHS title)"

section "snapshot"
$PWHS snap | head -10

echo ""
echo "links: $($PWHS eval "document.querySelectorAll('a').length")"
echo "screenshot: $($PWHS shot quickstart-shot)"

section "activity"
$PWHS poll 0 | head -30

echo ""
echo "OK — quickstart"
