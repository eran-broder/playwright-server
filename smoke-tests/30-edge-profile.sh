#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

start_session --browser edge --profile Default
echo "Edge launched on :$PORT"

section "navigation works"
$PWHS nav https://example.com
echo "title: $($PWHS title)"

section "cookies copied from real profile"
$PWHS play "const c = await context.cookies(); return { count: c.length, sampleDomains: [...new Set(c.map(x => x.domain))].slice(0, 8) };"

section "/status"
$PWHS status

echo ""
echo "OK — edge profile"
echo "(If 'count' above is 0, Edge was open during the snapshot."
echo " Close Edge fully and re-run for cookie transfer.)"
