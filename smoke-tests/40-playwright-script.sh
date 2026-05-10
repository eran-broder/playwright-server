#!/usr/bin/env bash
# 40-playwright-script.sh — examples of /script/execute-playwright, the
# escape hatch that gives full Playwright API access (page, context, browser).
# Use this whenever the high-level verbs (click/type/wait) aren't enough.
#
# pwhs play <js> = POST /script/execute-playwright {code}
#
# Inside the code, you have:
#   page     — Playwright Page (page.evaluate, page.locator, page.waitFor*)
#   context  — BrowserContext  (context.cookies, context.storageState)
#   browser  — Browser         (null with persistent context)
#
# The code runs as an async function — `return` returns the value to the
# caller (in contrast with /execute/inline, which evaluates an expression).
#
# Run from repo root:  bash smoke-tests/40-playwright-script.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWHS="${PWHS:-node $SCRIPT_DIR/../dist/pwhs.js}"

PORT=$($PWHS up)
trap "$PWHS down -p $PORT >/dev/null 2>&1 || true" EXIT
export PWHS_PORT=$PORT

$PWHS nav https://example.com

# Heredoc with single-quoted 'EOF' = no bash expansion, raw JS.
play() {
  local code; code="$(cat)"
  $PWHS play "$code"
}

echo ""
echo "--- 1. Read all <a> hrefs on the page ---"
play <<'EOF'
return await page.$$eval("a", links => links.map(a => a.href));
EOF

echo ""
echo "--- 2. Wait for an element, then read its text ---"
play <<'EOF'
await page.waitForSelector("h1");
return await page.locator("h1").innerText();
EOF

echo ""
echo "--- 3. Cookie inspection (context-level) ---"
play <<'EOF'
const c = await context.cookies();
const byDomain = {};
for (const x of c) byDomain[x.domain] = (byDomain[x.domain] || 0) + 1;
return { total: c.length, byDomain };
EOF

echo ""
echo "--- 4. Combined: navigate + extract structured data ---"
play <<'EOF'
await page.goto("https://example.org");
return {
  url: page.url(),
  title: await page.title(),
  h1: await page.locator("h1").innerText(),
  linkCount: await page.locator("a").count(),
};
EOF

echo ""
echo "--- 5. Set a cookie, read it back ---"
play <<'EOF'
await context.addCookies([{
  name: "smoke",
  value: "test-value",
  domain: "example.org",
  path: "/",
}]);
const cookies = await context.cookies("https://example.org");
const found = cookies.find(c => c.name === "smoke");
return found ? { name: found.name, value: found.value } : null;
EOF

echo ""
echo "OK — playwright-script smoke test passed."
