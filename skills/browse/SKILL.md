---
name: browse
description: Control a real Chromium browser via the Playwright Server. Use when the user wants to browse the web, automate pages, scrape content, fill forms, take screenshots, or interact with web applications.
user-invocable: true
disable-model-invocation: false
argument-hint: [URL or task description]
allowed-tools: Bash, Read
---

# Playwright Browser Automation

You control a real Chromium browser via HTTP API at `http://localhost:3456`.

## Server Management

Before any browser operation, ensure the server is running:

```bash
curl -sf http://localhost:3456/status
```

If the server is NOT running, start it:

```bash
cd "${CLAUDE_PLUGIN_ROOT}" && npm install --silent 2>/dev/null; npm run dev &
```

Wait ~5 seconds, then verify with `/status` again.

## Key Workflow

**Always follow this pattern:**

1. **Snapshot** - `GET /snapshot` to see what's on the page (accessibility tree)
2. **Act** - Perform action (click, type, navigate, etc.)
3. **Poll** - `GET /activity/poll?since=N` to see what happened (errors, network, console)
4. **Snapshot** - Verify the result

## API Quick Reference

### Navigation & Page State

| Method | Endpoint | Body/Params | Description |
|--------|----------|-------------|-------------|
| POST | /navigate | `{"url": "..."}` | Go to URL (waits for networkidle) |
| GET | /snapshot | `?selector=CSS` (opt) | **KEY** - Accessibility tree as YAML |
| GET | /url | - | Current URL |
| GET | /title | - | Page title |
| GET | /content | - | Full HTML (large - prefer /snapshot) |

### Page Interactions

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | /click | `{"selector": "CSS"}` | Click element |
| POST | /type | `{"selector": "CSS", "text": "..."}` | Type into input (replaces content) |
| POST | /hover | `{"selector": "CSS"}` | Hover element |
| POST | /select | `{"selector": "CSS", "value": "..."}` | Select dropdown option |
| POST | /keyboard | `{"key": "Enter"}` | Press key (Enter, Tab, Escape, ArrowDown...) |
| POST | /scroll | `{"x": 0, "y": 500}` | Scroll by pixels |
| POST | /wait | `{"selector": "CSS", "timeout": 30000}` | Wait for element to appear |

### Browser Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /status | Server and browser state |
| POST | /browser/start | Launch browser |
| POST | /browser/stop | Close browser |
| POST | /browser/restart | Restart browser (clears state) |

### Screenshots

| Method | Endpoint | Body/Params | Description |
|--------|----------|-------------|-------------|
| POST | /screenshot | `{"name": "...", "fullPage": true}` | Take screenshot |
| GET | /screenshot/:name | - | Get image file |
| GET | /screenshots | - | List all screenshots |

### Code Execution

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | /execute/inline | `{"code": "JS code"}` | Run JavaScript in page context |
| POST | /script/execute-playwright | `{"code": "..."}` | Run Playwright code with `page`, `context`, `browser` |
| POST | /script/save | `{"name": "...", "code": "..."}` | Save script to disk |
| POST | /script/execute | `{"name": "..."}` | Execute saved script |

### Activity Polling (Network, Console, Errors)

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| GET | /activity/poll | `?since=N&types=...` | **PRIMARY** - Events since watermark N |
| GET | /activity/check | `?since=N` | Quick check: any new events? |
| GET | /activity/log | `?types=...&limit=N&since=N` | Full log with filters |
| GET | /activity/summary | - | Event count stats |
| GET | /activity/status | - | Recording state |
| POST | /activity/start | `{"captureNetworkBodies": true}` | Start recording |
| POST | /activity/stop | - | Stop recording |
| DELETE | /activity/log | - | Clear all recorded activity |

### Page Management (Multiple Tabs)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | /pages | - | List open tabs |
| POST | /pages/switch | `{"index": N}` | Switch to tab by index |
| POST | /pages/switch-latest | - | Switch to newest tab |

## Activity Types

`network-request`, `network-response`, `network-failed`, `console`, `page-error`, `navigation`, `dialog`

## Example: Navigate and Explore

```bash
# Navigate to a page
curl -X POST http://localhost:3456/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# See what's on the page (accessibility tree)
curl http://localhost:3456/snapshot

# Get initial activity watermark
curl "http://localhost:3456/activity/poll?since=0"
# Response includes "watermark": N - save this for next poll

# Click something
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "a"}'

# Check what happened (network requests, errors, console output)
curl "http://localhost:3456/activity/poll?since=N"

# See the page again
curl http://localhost:3456/snapshot
```

## Tips

- **Snapshot before acting**: Always `GET /snapshot` to see page structure (roles, labels, states) before interacting
- **Use activity polling**: After actions, poll to catch network failures, JS errors, or console output
- **Prefer /snapshot over /content**: 2-5KB YAML vs 50-500KB HTML
- **Use /script/execute-playwright for advanced ops**: File uploads, drag & drop, network interception, multi-step Playwright scripts - anything Playwright can do
- **Handle multiple tabs**: Check `/pages` after clicking links that may open new tabs
- **Use selectors from snapshot**: The accessibility tree shows roles and labels - use CSS selectors, `[data-testid]`, or text selectors

## Selectors

```css
#id                          /* By ID */
.class                       /* By class */
button[type="submit"]        /* By attribute */
[data-testid="login-btn"]   /* By test ID */
form input[name="email"]    /* Nested */
text=Submit                  /* By text (Playwright) */
```

For complete API docs with response shapes and all fields, see the full reference:
${CLAUDE_PLUGIN_ROOT}/README-AI-AGENT.md

---

Task: $ARGUMENTS
