#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

start_session
$PWHS nav https://example.com

section "1. Read all <a> hrefs on the page"
pwhs_play_heredoc <<'EOF'
return await page.$$eval("a", links => links.map(a => a.href));
EOF

section "2. Wait for an element, then read its text"
pwhs_play_heredoc <<'EOF'
await page.waitForSelector("h1");
return await page.locator("h1").innerText();
EOF

section "3. Cookie inspection (context-level)"
pwhs_play_heredoc <<'EOF'
const c = await context.cookies();
const byDomain = {};
for (const x of c) byDomain[x.domain] = (byDomain[x.domain] || 0) + 1;
return { total: c.length, byDomain };
EOF

section "4. Combined: navigate + extract structured data"
pwhs_play_heredoc <<'EOF'
await page.goto("https://example.org");
return {
  url: page.url(),
  title: await page.title(),
  h1: await page.locator("h1").innerText(),
  linkCount: await page.locator("a").count(),
};
EOF

section "5. Set a cookie, read it back"
pwhs_play_heredoc <<'EOF'
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
echo "OK — playwright-script"
