#!/usr/bin/env bash
# 30-edge-profile.sh — launch Edge using your real Default profile. The
# server snapshots the profile to its session tempdir (cache dirs excluded)
# and launches Playwright on the copy. Bookmarks, history, extensions,
# preferences carry over; cookies + saved logins carry over only if Edge
# is fully closed during the snapshot (the cookie SQLite is exclusively
# locked while Edge runs).
#
# Run from repo root:  bash smoke-tests/30-edge-profile.sh
#
# Prerequisite: Microsoft Edge installed. Close it for full state transfer.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWHS="${PWHS:-node $SCRIPT_DIR/../dist/pwhs.js}"

# Spawn a server that launches Edge with --profile Default in copy mode.
# Forward --browser/--profile through `pwhs up`.
PORT=$($PWHS up --browser edge --profile Default)
trap "$PWHS down -p $PORT >/dev/null 2>&1 || true" EXIT
export PWHS_PORT=$PORT
echo "Edge launched on :$PORT"

# Navigate first; this forces the context to fully initialize before we
# inspect cookies. Querying cookies immediately after launch can race the
# cookie store loading.
echo ""
echo "--- navigation works ---"
$PWHS nav https://example.com
echo "title: $($PWHS title)"

# Cookies the launched Edge has at startup. With Edge closed during the
# snapshot, expect the user's real cookies (.bing.com, .msn.com, plus
# whatever sites the user is logged into). With Edge open, expect 0.
echo ""
echo "--- cookies copied from real profile ---"
$PWHS play "const c = await context.cookies(); return { count: c.length, sampleDomains: [...new Set(c.map(x => x.domain))].slice(0, 8) };"

# /status reflects which engine is running.
echo ""
echo "--- /status ---"
$PWHS status

echo ""
echo "OK — edge profile smoke test passed."
echo "(If 'count' above is 0, Edge was open during the snapshot."
echo " Close Edge fully and re-run for cookie transfer.)"
