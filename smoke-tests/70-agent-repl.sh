#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

if [ -z "${NREPL:-}" ] && ! command -v nrepl >/dev/null 2>&1; then
  echo "skipped: nrepl not available."
  echo "  Install: npm install -g github:eran-broder/agent-repl#main:/node"
  echo "  Or set NREPL=\"node /path/to/agent-repl/node/src/cli.js\""
  exit 0
fi

NREPL_BIN="${NREPL:-nrepl}"

SDK_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && (pwd -W 2>/dev/null || pwd))/dist/client.js"

REPL=$($NREPL_BIN create)
trap "$NREPL_BIN destroy $REPL >/dev/null 2>&1 || true; cleanup_all_sessions" EXIT
echo "REPL :$REPL"

section "bootstrap the SDK onto the REPL's global object"
$NREPL_BIN exec $REPL "globalThis.sdk = require('$SDK_PATH')"
$NREPL_BIN exec $REPL "globalThis.s = await sdk.startServer()"
$NREPL_BIN exec $REPL "({ port: s.port, pid: s.spawnedPid })"

section "drive the same browser across many separate exec calls"
$NREPL_BIN exec $REPL "await s.nav('https://example.com')"
$NREPL_BIN exec $REPL "await s.title()"
$NREPL_BIN exec $REPL "await s.eval('document.querySelectorAll(\"a\").length')"

section "multi-statement with await — declarations land on globalThis"
$NREPL_BIN exec $REPL "globalThis.titles = []"
$NREPL_BIN exec $REPL "for (const u of ['https://example.com', 'https://example.org', 'https://example.net']) { await s.nav(u); titles.push(await s.title()); }"
$NREPL_BIN exec $REPL "titles"

section "destructure an SDK response, names persist"
$NREPL_BIN exec $REPL "const { entries, watermark } = await s.poll(); ({ count: entries.length, watermark })"
$NREPL_BIN exec $REPL "watermark"

section "teardown: close the browser, then destroy the REPL"
$NREPL_BIN exec $REPL "await s.close()"

echo ""
echo "OK — agent-repl integration"
