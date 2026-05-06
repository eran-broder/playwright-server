# playwright-http-server

A local HTTP server that exposes Playwright browser automation as a REST API.
Drive a real Chromium browser via simple HTTP calls: navigate, click, type, screenshot, monitor network activity, execute JavaScript, run arbitrary Playwright code.

## Install

```bash
npm install
npx playwright install chromium    # one-time, downloads Chromium
```

## Run

### Development (from source)
```bash
npm run dev
```

### Published binary
```bash
npm install -g playwright-http-server
playwright-http-server
```

Every invocation spawns an **isolated session** — a fresh tempdir for screenshots/scripts and an OS-picked free port. Both are printed on startup:

```
[session] workdir: /tmp/playwright-http-aB3xK1
Playwright server running on port 62058
```

Run as many concurrent instances as you want; sessions never collide.

### Optional flags

| Flag | Description |
|------|-------------|
| `--port <n>` | Pin a specific port instead of auto-picking. |
| `--dir <path>` | Pin a specific working directory instead of a fresh tempdir. |
| `-h, --help` | Show help. |

```bash
playwright-http-server --port 3456           # fixed port, fresh tempdir
playwright-http-server --dir ./mySession     # fixed dir, auto port
```

Env vars also work: `PORT`, `SCREENSHOTS_DIR`, `SCRIPTS_DIR`.

---

## CLI: `pwhs`

The package ships a second binary, `pwhs`, that wraps the HTTP API in short verbs. It's the path of least resistance from a shell:

```bash
# Start one or more servers
P=$(pwhs up)              # prints just the port — capture it
pwhs ls                   # see all running servers

# Drive a server
pwhs -p $P nav https://example.com
pwhs -p $P click "button.submit"
pwhs -p $P snap                       # accessibility tree
pwhs -p $P shot                       # screenshot, prints filepath
pwhs -p $P eval "document.title"      # JS in page context

# Or set $PWHS_PORT once and skip the flag
export PWHS_PORT=$P
pwhs nav https://example.com
pwhs click "button.submit"

# Tear down
pwhs down -p $P
pwhs down --all
```

### Port selection model

There is no automatic default. Each verb resolves its target server in this order:

1. `-p <port>` (or `--port <port>`) flag — wins per-call
2. `$PWHS_PORT` env var — shell-sticky default
3. Otherwise: error, listing every running server's port

This is by design: with multiple servers up, "guessing" silently is worse than failing loudly.

### Lifecycle and discovery

Each running server registers itself in `~/.pwhs/sessions.json` (or `%LOCALAPPDATA%\pwhs\sessions.json` on Windows) with `{port, workdir, pid, startedAt}`. `pwhs ls` reads it and prunes entries whose pid is no longer alive, so the listing is always accurate even after ungraceful exits.

### Verb reference

```
pwhs up [server-flags]      Start a server, print its port to stdout
pwhs down [-p <port>]       Stop a specific server
pwhs down --all             Stop every running server
pwhs ls                     List running servers

pwhs status                 GET /status
pwhs start [device]         POST /browser/start (optional device emulation)
pwhs stop                   POST /browser/stop
pwhs restart [device]       POST /browser/restart

pwhs nav <url>              POST /navigate
pwhs url | title | html     GETs that print only the value
pwhs snap [selector]        GET /snapshot

pwhs click <selector>
pwhs type <selector> <text>
pwhs hover <selector>
pwhs select <selector> <value>
pwhs scroll [x] [y]
pwhs key <key>
pwhs wait <selector> [ms]

pwhs shot [name]            POST /screenshot, prints filepath
pwhs shots                  GET /screenshots

pwhs eval <js>              POST /execute/inline (page context, expression — not a function body)
pwhs play <js>              POST /script/execute-playwright (Playwright API; can use return)

pwhs poll [since]
pwhs check [since]
pwhs pages
pwhs switch <index>
pwhs latest
```

Output discipline: single-value responses (`url`, `title`, `eval`, `shot`) print just the value. Multi-field responses print pretty JSON. Errors go to stderr with non-zero exit.

---

## API

All requests use `Content-Type: application/json`. All responses are JSON with a top-level `success: true|false` field.

### Quick reference

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| Status | GET | `/status` | Server + browser state |
| Browser | POST | `/browser/start` | Launch browser (accepts `{device}`) |
| Browser | POST | `/browser/stop` | Close browser |
| Browser | POST | `/browser/restart` | Restart browser (accepts `{device}`) |
| Navigation | POST | `/navigate` | Go to a URL |
| Navigation | GET | `/url` | Current page URL |
| Navigation | GET | `/title` | Current page title |
| Page info | GET | `/content` | Full page HTML |
| Page info | GET | `/snapshot` | Accessibility tree (YAML-style, compact) |
| Interaction | POST | `/click` | Click element by selector |
| Interaction | POST | `/type` | Fill/type into element |
| Interaction | POST | `/hover` | Hover over element |
| Interaction | POST | `/select` | Select dropdown option |
| Interaction | POST | `/scroll` | Scroll page |
| Interaction | POST | `/keyboard` | Press a key |
| Interaction | POST | `/wait` | Wait for selector to appear |
| Screenshots | POST | `/screenshot` | Take screenshot (saved to disk) |
| Screenshots | GET | `/screenshots` | List all screenshots |
| Screenshots | GET | `/screenshot/:name` | Fetch a screenshot file |
| JS execution | POST | `/execute/inline` | Run JS **inside** the page |
| Playwright code | POST | `/script/execute-playwright` | Run arbitrary Playwright code |
| Scripts | POST | `/script/save` | Save a named script to disk |
| Scripts | POST | `/script/execute` | Execute a saved script |
| Multi-tab | GET | `/pages` | List all open pages/tabs |
| Multi-tab | POST | `/pages/switch` | Switch to page by index |
| Multi-tab | POST | `/pages/switch-latest` | Switch to most recently opened tab |
| Activity | GET | `/activity/poll` | Poll events since watermark (main monitoring endpoint) |
| Activity | GET | `/activity/check` | Quick status check (new events since watermark?) |
| Activity | GET | `/activity/log` | Full activity log with filters |
| Activity | GET | `/activity/summary` | Aggregate stats |
| Activity | GET | `/activity/status` | Recording state |
| Activity | POST | `/activity/start` | Start recording |
| Activity | POST | `/activity/stop` | Stop recording |
| Activity | DELETE | `/activity/log` | Clear activity log |
| Activity | POST | `/activity/config` | Configure recording options |

---

## Endpoint details

### GET /status

```json
{
  "server": "running",
  "browser": true,
  "page": true,
  "currentUrl": "https://example.com",
  "recording": { "enabled": true, "entryCount": 42, "watermark": 42 },
  "screenshotsDir": "/tmp/playwright-http-abc/screenshots",
  "scriptsDir": "/tmp/playwright-http-abc/scripts"
}
```

### POST /browser/start

```json
{ "device": "iPhone 14" }
```

`device` is optional. Accepts any Playwright device name (`iPhone 14`, `Pixel 7`, `iPad Mini`, `Desktop Chrome`, etc.) — sets viewport, user agent, touch, and DPR.

### POST /navigate

```json
{ "url": "https://example.com" }
```

Uses `waitUntil: networkidle`. Returns `{ "success": true, "url": "https://example.com" }`.

> **Note for SPAs**: Some single-page applications never reach `networkidle` due to websockets or long-polling. If navigate hangs, use a generous client-side timeout (30–60 s) — the page usually loads fine before networkidle resolves.

### GET /snapshot

Returns a compact YAML-style accessibility tree. Much lighter than raw HTML (2–5 KB vs 50–500 KB):

```yaml
- heading "Login" [level=1]
- textbox "Email" [focused]
- textbox "Password"
- button "Sign In"
```

Optional query param: `?selector=nav` to snapshot only a subtree.

### POST /click

```json
{ "selector": "button#submit" }
```

### POST /type

```json
{ "selector": "input[name=email]", "text": "user@example.com" }
```

Uses Playwright `fill` (clears existing value first).

### POST /hover

```json
{ "selector": ".dropdown-trigger" }
```

### POST /select

```json
{ "selector": "select#country", "value": "US" }
```

### POST /scroll

```json
{ "x": 0, "y": 500 }
```

### POST /keyboard

```json
{ "key": "Enter" }
```

Any Playwright key name: `Enter`, `Tab`, `Escape`, `ArrowDown`, `Control+A`, etc.

### POST /wait

```json
{ "selector": ".loaded", "timeout": 10000 }
```

`timeout` is in milliseconds, default 30000.

### POST /screenshot

```json
{ "name": "after-login", "fullPage": true }
```

Both fields are optional. `name` defaults to a timestamp-based name. `fullPage` defaults to `true`.

Response:
```json
{ "success": true, "filename": "after-login.png", "path": "/tmp/.../screenshots/after-login.png" }
```

### GET /screenshot/:name

Serves the PNG file directly (not base64). E.g. `GET /screenshot/after-login.png`.

### POST /execute/inline

Runs JavaScript **inside the page context** (like browser devtools console):

```json
{ "code": "return document.querySelectorAll('a').length" }
```

Response: `{ "success": true, "result": 12 }`

### POST /script/execute-playwright

Runs arbitrary code with access to Playwright's `page`, `context`, and `browser` objects:

```json
{ "code": "await page.waitForSelector('.loaded'); return await page.title();" }
```

Anything Playwright can do, this endpoint can do.

### GET /activity/poll

**The primary monitoring endpoint.** Returns all events since a watermark ID:

```
GET /activity/poll?since=0          # all events
GET /activity/poll?since=150        # only events after id 150
GET /activity/poll?since=0&types=network-request,console
```

Each response includes a `watermark` field — pass it as `since` in the next call for incremental updates.

Activity types: `network-request`, `network-response`, `network-failed`, `console`, `page-error`, `navigation`, `dialog`, `download`.

**Example response:**
```json
{
  "success": true,
  "entries": [
    {
      "id": 1,
      "timestamp": 1700000000000,
      "type": "navigation",
      "data": { "url": "https://example.com", "eventType": "load" }
    },
    {
      "id": 2,
      "timestamp": 1700000000100,
      "type": "network-request",
      "data": { "method": "GET", "url": "https://api.example.com/data", "resourceType": "fetch" }
    }
  ],
  "watermark": 2
}
```

### POST /activity/start

```json
{ "captureNetworkBodies": true }
```

Recording auto-starts when browser launches. `captureNetworkBodies` (default `false`) enables capturing response bodies for JSON/text responses (up to 1 MB each).

### DELETE /activity/log

Clears all recorded activity entries.

---

## End-to-end example

```bash
export PORT=3456

# Start browser
curl -s -X POST http://localhost:$PORT/browser/start -H "Content-Type: application/json" -d "{}"

# Navigate
curl -s -X POST http://localhost:$PORT/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Inspect page structure (compact, AI-friendly)
curl -s http://localhost:$PORT/snapshot

# Click a link
curl -s -X POST http://localhost:$PORT/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "a"}'

# What happened? (network, console, errors)
curl -s "http://localhost:$PORT/activity/poll?since=0"

# Fill a form
curl -s -X POST http://localhost:$PORT/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "input[name=email]", "text": "user@example.com"}'

# Submit
curl -s -X POST http://localhost:$PORT/keyboard \
  -H "Content-Type: application/json" \
  -d '{"key": "Enter"}'

# Screenshot
curl -s -X POST http://localhost:$PORT/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "result"}'

# Run arbitrary Playwright code
curl -s -X POST http://localhost:$PORT/script/execute-playwright \
  -H "Content-Type: application/json" \
  -d '{"code": "const rows = await page.$$eval('tr', els => els.map(e => e.innerText)); return rows;"}'

# Stop browser
curl -s -X POST http://localhost:$PORT/browser/stop -H "Content-Type: application/json" -d "{}"
```

---

## Auth state persistence

Drop an `auth.json` (Playwright storage state format) in the session workdir and it auto-loads on browser start, restoring cookies and localStorage.

To capture state from a live session:

```javascript
// via /script/execute-playwright:
await context.storageState({ path: 'auth.json' });
```

---

## Architecture

The server is built from focused modules:

| Module | Responsibility |
|--------|---------------|
| `cli.ts` | Arg parsing, tempdir/port setup, env wiring |
| `server.ts` | Express routes and request validation |
| `browser-manager.ts` | Playwright browser/context/page lifecycle |
| `activity-recorder.ts` | Event capture (network, console, errors, navigation, dialogs) |
| `screenshot-manager.ts` | Screenshot naming, path management, listing |
| `script-manager.ts` | Save and execute named Playwright scripts |

---

## License

MIT
