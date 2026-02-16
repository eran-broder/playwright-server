# Playwright Server - AI Agent Guide

A local HTTP API for browser automation via Playwright. Designed for AI agents to control a browser, capture screenshots, monitor network activity, and execute JavaScript.

## Quick Start

```bash
# Start server (default port 3456)
npm run dev

# Or with custom port
PORT=8080 npm run dev
```

Server runs at `http://localhost:3456`

---

## Core Concepts

### 1. Browser Lifecycle
The server manages a single Chromium browser instance. You must start the browser before performing any page operations.

### 2. Activity Recording
All browser events (network, console, errors, navigation) are recorded with incrementing IDs. Use **watermark-based polling** to efficiently get new events since your last check.

### 3. Response Format
All endpoints return JSON with this structure:
```json
{ "success": true, ...data }
{ "success": false, "error": "error message" }
```

---

## API Reference

### Status

#### `GET /status`
Check server and browser state.

```bash
curl http://localhost:3456/status
```

Response:
```json
{
  "server": "running",
  "browser": true,
  "page": true,
  "currentUrl": "https://example.com",
  "recording": {
    "enabled": true,
    "autoStart": true,
    "captureNetworkBodies": false,
    "entryCount": 150,
    "watermark": 150
  },
  "screenshotsDir": "/path/to/screenshots",
  "scriptsDir": "/path/to/scripts"
}
```

---

### Browser Control

#### `POST /browser/start`
Launch browser. Called automatically on server start, but use this after `/browser/stop`.

```bash
curl -X POST http://localhost:3456/browser/start
```

#### `POST /browser/stop`
Close browser completely.

```bash
curl -X POST http://localhost:3456/browser/stop
```

#### `POST /browser/restart`
Stop and start browser (clears all state).

```bash
curl -X POST http://localhost:3456/browser/restart
```

---

### Navigation

#### `POST /navigate`
Navigate to a URL. Waits for `networkidle`.

```bash
curl -X POST http://localhost:3456/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

#### `GET /url`
Get current page URL.

```bash
curl http://localhost:3456/url
```

#### `GET /title`
Get current page title.

```bash
curl http://localhost:3456/title
```

#### `GET /content`
Get full page HTML (large, use `/snapshot` instead when possible).

```bash
curl http://localhost:3456/content
```

#### `GET /snapshot`
**KEY ENDPOINT** - Get the accessibility tree as structured YAML. This is a lightweight, semantic representation of the page (2-5KB vs 50-500KB for raw HTML). Use this to understand page structure before interacting.

```bash
# Full page snapshot
curl http://localhost:3456/snapshot

# Snapshot of a specific element
curl "http://localhost:3456/snapshot?selector=form"
curl "http://localhost:3456/snapshot?selector=nav"
```

Response:
```json
{
  "success": true,
  "snapshot": "- heading \"Login\" [level=1]\n- textbox \"Email\" [focused]\n- textbox \"Password\"\n- button \"Sign In\"\n- link \"Forgot password?\""
}
```

The YAML tree contains roles, accessible names, states, and structure:
```yaml
- heading "Login" [level=1]
- textbox "Email" [focused]
- textbox "Password"
- button "Sign In"
- link "Forgot password?":
  - /url: /reset
```

Use this to:
- Understand what's on the page without screenshots
- Find the right selectors for interactions
- Verify state after actions (element visible, checked, disabled, etc.)
- Navigate complex UIs by role and label

---

### Page Interactions

#### `POST /click`
Click an element by CSS selector.

```bash
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "button.submit"}'
```

#### `POST /type`
Type text into an input field (replaces existing content).

```bash
curl -X POST http://localhost:3456/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "input[name=email]", "text": "user@example.com"}'
```

#### `POST /hover`
Hover over an element.

```bash
curl -X POST http://localhost:3456/hover \
  -H "Content-Type: application/json" \
  -d '{"selector": ".dropdown-trigger"}'
```

#### `POST /select`
Select an option from a `<select>` element.

```bash
curl -X POST http://localhost:3456/select \
  -H "Content-Type: application/json" \
  -d '{"selector": "select#country", "value": "US"}'
```

#### `POST /keyboard`
Press a keyboard key.

```bash
curl -X POST http://localhost:3456/keyboard \
  -H "Content-Type: application/json" \
  -d '{"key": "Enter"}'
```

Common keys: `Enter`, `Tab`, `Escape`, `ArrowDown`, `ArrowUp`, `Backspace`, `Delete`

#### `POST /scroll`
Scroll the page by pixels.

```bash
curl -X POST http://localhost:3456/scroll \
  -H "Content-Type: application/json" \
  -d '{"x": 0, "y": 500}'
```

#### `POST /wait`
Wait for an element to appear. Default timeout: 30000ms (30 seconds).

```bash
curl -X POST http://localhost:3456/wait \
  -H "Content-Type: application/json" \
  -d '{"selector": ".loading-complete", "timeout": 10000}'
```

---

### Screenshots

#### `POST /screenshot`
Take a screenshot.

```bash
curl -X POST http://localhost:3456/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "my-screenshot", "fullPage": true}'
```

Response:
```json
{
  "success": true,
  "filename": "my-screenshot.png",
  "path": "/full/path/to/my-screenshot.png"
}
```

Parameters:
- `name` (optional): Filename without extension. Auto-generated if omitted.
- `fullPage` (optional): Capture entire page, not just viewport. Default: `true`

#### `GET /screenshot/:name`
Retrieve a screenshot image.

```bash
curl http://localhost:3456/screenshot/my-screenshot -o screenshot.png
```

#### `GET /screenshots`
List all screenshots.

```bash
curl http://localhost:3456/screenshots
```

---

### Code Execution

#### `POST /execute/inline`
Execute JavaScript in the browser page context.

```bash
curl -X POST http://localhost:3456/execute/inline \
  -H "Content-Type: application/json" \
  -d '{"code": "document.querySelectorAll(\"a\").length"}'
```

Response:
```json
{ "success": true, "result": 42 }
```

#### `POST /script/execute-playwright`
Execute Playwright code with access to `page`, `context`, and `browser` objects.

```bash
curl -X POST http://localhost:3456/script/execute-playwright \
  -H "Content-Type: application/json" \
  -d '{"code": "await page.waitForSelector(\".loaded\"); return await page.title();"}'
```

#### `POST /script/save`
Save a script to disk.

```bash
curl -X POST http://localhost:3456/script/save \
  -H "Content-Type: application/json" \
  -d '{"name": "login-flow", "code": "console.log(\"Hello\");"}'
```

#### `POST /script/execute`
Execute a saved script via ts-node.

```bash
curl -X POST http://localhost:3456/script/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "login-flow"}'
```

---

### Page Management (Multiple Tabs)

#### `GET /pages`
List all open pages/tabs.

```bash
curl http://localhost:3456/pages
```

Response:
```json
{
  "success": true,
  "pages": [
    { "index": 0, "url": "https://example.com", "title": "Example" },
    { "index": 1, "url": "https://other.com", "title": "Other Page" }
  ]
}
```

#### `POST /pages/switch`
Switch to a specific page by index.

```bash
curl -X POST http://localhost:3456/pages/switch \
  -H "Content-Type: application/json" \
  -d '{"index": 1}'
```

#### `POST /pages/switch-latest`
Switch to the most recently opened page.

```bash
curl -X POST http://localhost:3456/pages/switch-latest
```

---

### Activity Recording (KEY FEATURE)

Activity recording captures all browser events. Use watermark-based polling to efficiently track what happened.

#### `GET /activity/poll?since=N&types=...`
**PRIMARY ENDPOINT** - Get all events since watermark N.

Query parameters:
- `since` (required): Watermark ID. Use `0` for first call.
- `types` (optional): Comma-separated filter, e.g. `types=console,page-error`

```bash
# First call (get everything)
curl "http://localhost:3456/activity/poll?since=0"

# Subsequent calls (only new events)
curl "http://localhost:3456/activity/poll?since=150"

# Filter by type
curl "http://localhost:3456/activity/poll?since=150&types=network-request,network-response"
```

Response:
```json
{
  "success": true,
  "entries": [
    {
      "id": 151,
      "timestamp": 1699900000000,
      "type": "network-request",
      "data": { "method": "GET", "url": "https://api.example.com/data" }
    },
    {
      "id": 152,
      "timestamp": 1699900000100,
      "type": "console",
      "data": { "messageType": "log", "text": "App loaded" }
    }
  ],
  "watermark": 152,
  "summary": { "network-request": 1, "console": 1 }
}
```

**Workflow:**
1. Call `/activity/poll?since=0` to get initial watermark
2. Perform actions (click, navigate, etc.)
3. Call `/activity/poll?since={last_watermark}` to get new events
4. Repeat

#### `GET /activity/check?since=N`
Quick check if anything happened (no full data).

```bash
curl "http://localhost:3456/activity/check?since=150"
```

Response:
```json
{
  "success": true,
  "newEntries": 5,
  "watermark": 155,
  "hasConsoleErrors": false,
  "hasPageErrors": false,
  "hasNetworkFailures": false,
  "lastActivityTime": 1699900001000
}
```

#### `GET /activity/log`
Get activity log with filtering.

```bash
# Get last 100 network events
curl "http://localhost:3456/activity/log?types=network-request,network-response&limit=100"

# Get events since timestamp
curl "http://localhost:3456/activity/log?since=150"
```

#### `GET /activity/summary`
Get activity statistics.

```bash
curl http://localhost:3456/activity/summary
```

#### `GET /activity/status`
Get recording state.

```bash
curl http://localhost:3456/activity/status
```

#### `POST /activity/start`
Start recording (auto-started by default).

```bash
curl -X POST http://localhost:3456/activity/start \
  -H "Content-Type: application/json" \
  -d '{"captureNetworkBodies": true}'
```

#### `POST /activity/stop`
Stop recording.

```bash
curl -X POST http://localhost:3456/activity/stop
```

#### `DELETE /activity/log`
Clear all recorded activity.

```bash
curl -X DELETE http://localhost:3456/activity/log
```

#### `POST /activity/config`
Configure recording behavior.

```bash
curl -X POST http://localhost:3456/activity/config \
  -H "Content-Type: application/json" \
  -d '{"autoStart": true}'
```

Response:
```json
{ "success": true, "state": { "enabled": true, "autoStart": true, "captureNetworkBodies": false, "entryCount": 0, "watermark": 0 } }
```

---

## Activity Types

| Type | Description | Data Fields |
|------|-------------|-------------|
| `network-request` | HTTP request initiated | `method`, `url`, `resourceType`, `headers`, `postData?` |
| `network-response` | HTTP response received | `method`, `url`, `resourceType`, `status`, `statusText`, `headers`, `duration?`, `responseBody?` |
| `network-failed` | Request failed | `method`, `url`, `resourceType`, `failure?` |
| `console` | Console message | `messageType`, `text`, `location?`, `args?` |
| `page-error` | JavaScript error | `message`, `stack?` |
| `navigation` | Page navigation | `url`, `eventType` (load/domcontentloaded/framenavigated) |
| `dialog` | Alert/confirm/prompt | `dialogType`, `message`, `defaultValue?`, `handled`, `response?` |

`console.messageType` values: `log`, `debug`, `info`, `error`, `warning`, `dir`, `trace`, `assert`

`dialog.dialogType` values: `alert`, `confirm`, `prompt`, `beforeunload`

---

## Common Workflows

### 1. Basic Navigation and Screenshot

```bash
# Navigate to page
curl -X POST http://localhost:3456/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Take screenshot
curl -X POST http://localhost:3456/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "example-home"}'
```

### 2. Form Submission with Activity Monitoring

```bash
# Get initial watermark
WATERMARK=$(curl -s "http://localhost:3456/activity/poll?since=0" | jq -r '.watermark')

# Fill form
curl -X POST http://localhost:3456/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "input[name=username]", "text": "myuser"}'

curl -X POST http://localhost:3456/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "input[name=password]", "text": "mypass"}'

# Submit
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "button[type=submit]"}'

# Check what happened (network requests, errors, etc.)
curl -s "http://localhost:3456/activity/poll?since=$WATERMARK"
```

### 3. Wait for Dynamic Content

```bash
# Click button that loads content
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": ".load-more"}'

# Wait for content to appear
curl -X POST http://localhost:3456/wait \
  -H "Content-Type: application/json" \
  -d '{"selector": ".new-content", "timeout": 10000}'

# Now interact with new content
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": ".new-content .item"}'
```

### 4. Handle Popups/New Tabs

```bash
# Click link that opens new tab
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "a[target=_blank]"}'

# Switch to new tab
curl -X POST http://localhost:3456/pages/switch-latest

# Work in new tab
curl http://localhost:3456/url

# Switch back to original
curl -X POST http://localhost:3456/pages/switch \
  -H "Content-Type: application/json" \
  -d '{"index": 0}'
```

### 5. Extract Data with JavaScript

```bash
# Get all links on page
curl -X POST http://localhost:3456/execute/inline \
  -H "Content-Type: application/json" \
  -d '{"code": "Array.from(document.querySelectorAll(\"a\")).map(a => ({text: a.textContent, href: a.href}))"}'

# Get table data
curl -X POST http://localhost:3456/execute/inline \
  -H "Content-Type: application/json" \
  -d '{"code": "Array.from(document.querySelectorAll(\"table tr\")).map(row => Array.from(row.cells).map(cell => cell.textContent))"}'
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Browser not started` | Browser closed or not initialized | Call `POST /browser/start` |
| `Element not found` | Selector doesn't match any element | Verify selector, wait for element |
| `Timeout` | Element didn't appear in time | Increase timeout, check page state |
| `Navigation failed` | URL unreachable | Check URL, network connectivity |

### Robust Pattern

```bash
# 1. Check status first
STATUS=$(curl -s http://localhost:3456/status)
if [ "$(echo $STATUS | jq -r '.browser')" != "true" ]; then
  curl -X POST http://localhost:3456/browser/start
fi

# 2. Perform action with error checking
RESULT=$(curl -s -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": ".button"}')

if [ "$(echo $RESULT | jq -r '.success')" != "true" ]; then
  echo "Error: $(echo $RESULT | jq -r '.error')"
fi
```

---

## Best Practices for AI Agents

### 1. Snapshot First, Then Act
Always call `GET /snapshot` before interacting with a page. The accessibility tree tells you exactly what's on the page - roles, labels, states - so you can write precise selectors. This is cheaper and faster than screenshots.

### 2. Poll Activity After Actions
After any action that might trigger network requests or page changes, poll activity to understand what happened. The pattern: `snapshot -> act -> poll -> snapshot`.

### 3. Use Screenshots Only When Needed
Use screenshots for visual verification (layout, colors, images). For understanding page structure and finding elements, prefer `/snapshot`.

### 4. Wait for Elements Before Interacting
Use `/wait` before clicking/typing on elements that might not be immediately available.

### 5. Check for Errors in Activity Log
After form submissions or API calls, check activity for `network-failed` or `page-error` entries.

### 6. Use `/script/execute-playwright` for Advanced Operations
For anything not covered by the simple endpoints (drag & drop, file upload, network interception, PDF generation), use the Playwright code execution endpoint. You have full access to `page`, `context`, and `browser`.

### 7. Handle Multiple Pages
If an action might open a new tab, check `/pages` and switch as needed.

---

## Selectors Cheat Sheet

```css
/* By ID */
#submit-button

/* By class */
.primary-button

/* By attribute */
[data-testid="login-button"]
input[type="email"]
a[href*="login"]

/* By text content (Playwright-specific in execute) */
text=Submit
text="Exact Match"

/* Combining */
form.login input[name="password"]
.modal .close-button

/* Nth child */
ul li:nth-child(3)
table tr:first-child td:last-child
```

---

## Rate Limiting

No built-in rate limiting. For stability:
- Add 100-500ms delays between rapid actions
- Wait for network idle after navigation
- Use `/wait` for dynamic content

---

## File Locations

- Screenshots: `./screenshots/` (also served at `/static/screenshots/`)
- Scripts: `./scripts/`
- Auth state: `./auth.json` (auto-loaded on browser start if present, restores cookies/localStorage)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Server port |

---

## TypeScript Types

If building integrations, key types are exported from `src/types.ts`:

```typescript
interface ActivityEntry {
  id: number;
  timestamp: number;
  type: ActivityType;
  data: unknown;
}

type ActivityType =
  | 'network-request'
  | 'network-response'
  | 'network-failed'
  | 'console'
  | 'page-error'
  | 'navigation'
  | 'dialog'
  | 'download';
```
