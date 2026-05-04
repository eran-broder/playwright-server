# playwright-http-server

A local HTTP server that exposes Playwright browser automation as a REST API. Drive a real Chromium browser via curl: navigate, click, type, screenshot, monitor network activity, execute JavaScript, run arbitrary Playwright code.

## Install

```bash
npm install -g playwright-http-server
npx playwright install chromium    # one-time, downloads Chromium
```

## Run

```bash
playwright-http-server
```

Every invocation spawns an isolated session — a fresh tempdir for screenshots/scripts/auth and an OS-picked free port. Both are printed on startup:

```
[session] workdir: /tmp/playwright-http-aB3xK1
Playwright Server running on http://localhost:62058
```

Run as many concurrent instances as you want; sessions never collide.

### Optional overrides

| Flag | Description |
|------|-------------|
| `--port <n>` | Pin a specific port instead of auto-picking. |
| `--dir <path>` | Pin a specific working directory instead of a fresh tempdir. |
| `-h, --help` | Show help. |

```bash
playwright-http-server --port 3456           # fixed port, fresh tempdir
playwright-http-server --dir ./mySession     # fixed dir, fresh port
```

Env vars also work: `PORT`, `SCREENSHOTS_DIR`, `SCRIPTS_DIR`, `AUTH_PATH`.

## API

In the examples below, `$PORT` is the port the server printed at startup. Either `export PORT=62058` or substitute the actual number.

### Endpoint summary

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Status | `GET /status` | Server + browser state |
| Browser | `POST /browser/start\|stop\|restart` | Lifecycle. `start` accepts `{ device }` for emulation (e.g. `iPhone 14`, `Pixel 7`). |
| Navigation | `POST /navigate`, `GET /url\|title` | Go to URLs, read current state |
| Snapshot | `GET /snapshot` | Accessibility tree as YAML |
| Interaction | `POST /click\|type\|hover\|select\|keyboard\|scroll\|wait` | Page interactions |
| Screenshots | `POST /screenshot`, `GET /screenshots`, `GET /screenshot/:name` | Capture, list, fetch |
| Content | `GET /content` | Full page HTML |
| Code execution | `POST /execute/inline`, `POST /script/execute-playwright`, `POST /script/save\|execute` | Run JS or Playwright code |
| Activity | `GET /activity/poll\|check\|log\|summary\|status`, `POST /activity/start\|stop\|config`, `DELETE /activity/log` | Network, console, error monitoring |
| Pages | `GET /pages`, `POST /pages/switch\|switch-latest` | Multi-tab management |

### Accessibility snapshot

Structured YAML accessibility tree — 2–5 KB vs 50–500 KB for raw HTML:

```bash
curl http://localhost:$PORT/snapshot
curl "http://localhost:$PORT/snapshot?selector=nav"
```

```yaml
- heading "Login" [level=1]
- textbox "Email" [focused]
- textbox "Password"
- button "Sign In"
```

### Activity recording

All browser events (network requests/responses, console, page errors, navigation, dialogs) are captured with incrementing integer IDs. Poll using a watermark:

```bash
# Initial fetch + watermark
curl "http://localhost:$PORT/activity/poll?since=0"

# After performing actions, fetch only new events
curl "http://localhost:$PORT/activity/poll?since=150"
```

Recording auto-starts on browser launch. Stop with `POST /activity/stop`, clear with `DELETE /activity/log`.

### Arbitrary Playwright code

Direct access to Playwright's `page`, `context`, and `browser` objects — anything Playwright can do, this endpoint can do:

```bash
curl -X POST http://localhost:$PORT/script/execute-playwright \
  -H "Content-Type: application/json" \
  -d '{"code": "await page.waitForSelector(\".loaded\"); return await page.title();"}'
```

### Inline JavaScript on the page

For code that runs *inside* the page (no Playwright API access):

```bash
curl -X POST http://localhost:$PORT/execute/inline \
  -H "Content-Type: application/json" \
  -d '{"code": "return document.querySelectorAll(\"a\").length"}'
```

### Auth state persistence

Drop an `auth.json` file (Playwright storage state format) in the working directory and it auto-loads on browser start, restoring cookies and localStorage.

To capture state from a session: `await context.storageState({ path: 'auth.json' })`.

### Device emulation

Start the browser with a Playwright device profile:

```bash
curl -X POST http://localhost:$PORT/browser/start \
  -H "Content-Type: application/json" \
  -d '{"device": "iPhone 14"}'
```

Sets viewport, user agent, touch, and DPR atomically. Common values: `iPhone 14`, `Pixel 7`, `iPad Mini`, `Desktop Chrome`.

## End-to-end example

```bash
# Navigate
curl -X POST http://localhost:$PORT/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Inspect the page structure
curl http://localhost:$PORT/snapshot

# Interact
curl -X POST http://localhost:$PORT/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "a"}'

# Inspect what happened (network, console, errors)
curl "http://localhost:$PORT/activity/poll?since=0"

# Capture
curl -X POST http://localhost:$PORT/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "after-click"}'
```

## Develop locally

```bash
git clone https://github.com/eran-broder/playwright-server
cd playwright-server
npm install
npx playwright install chromium
npm run dev
```

`npm run dev` goes through the same CLI as the published binary, so it also gets a fresh port + tempdir per invocation.

## License

MIT
