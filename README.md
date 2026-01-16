# Playwright Server

A local TypeScript/Node.js webserver that exposes an API for instrumenting Playwright via curl commands.

## Setup

```bash
cd playwright-server
npm install
npx playwright install chromium
```

## Run

```bash
npm run dev
```

Server runs on `http://localhost:3456`

## API Reference

### Browser Management

```bash
# Check server status
curl http://localhost:3456/status

# Start browser (default - no extension)
curl -X POST http://localhost:3456/browser/start

# Start browser with unpacked Chrome extension
curl -X POST http://localhost:3456/browser/start \
  -H "Content-Type: application/json" \
  -d '{"extensionPath": "/path/to/unpacked/extension"}'

# Start browser with extension and custom user data directory
curl -X POST http://localhost:3456/browser/start \
  -H "Content-Type: application/json" \
  -d '{
    "extensionPath": "/path/to/unpacked/extension",
    "userDataDir": "/path/to/user/data"
  }'

# Stop browser
curl -X POST http://localhost:3456/browser/stop

# Restart browser (keeps current configuration)
curl -X POST http://localhost:3456/browser/restart

# Restart browser with new extension
curl -X POST http://localhost:3456/browser/restart \
  -H "Content-Type: application/json" \
  -d '{"extensionPath": "/path/to/different/extension"}'
```

**Browser Start Options:**
- `extensionPath` (optional): Absolute path to unpacked Chrome extension directory
- `userDataDir` (optional): Custom user data directory for browser profile
- `headless` (optional): Run in headless mode (default: false)

**Note on Extensions:**
- The extension must be an **unpacked** Chrome extension directory (not a .crx file)
- The extension directory should contain a `manifest.json` file
- When an extension is loaded, the browser uses a persistent context to maintain extension state
- The extension will be automatically loaded on browser start/restart

### Navigation

```bash
# Navigate to URL
curl -X POST http://localhost:3456/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Navigate to local test page
curl -X POST http://localhost:3456/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "file:///C:/t/books/playwright-server/test-page.html"}'
```

### Screenshots

```bash
# Take screenshot (auto-named)
curl -X POST http://localhost:3456/screenshot \
  -H "Content-Type: application/json" \
  -d '{}'

# Take named screenshot
curl -X POST http://localhost:3456/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "my-screenshot", "fullPage": true}'

# List all screenshots
curl http://localhost:3456/screenshots

# Download screenshot (returns PNG image)
curl http://localhost:3456/screenshot/my-screenshot -o screenshot.png
```

### Page Interaction

```bash
# Click element
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "#submit-btn"}'

# Type text
curl -X POST http://localhost:3456/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "#username", "text": "myuser"}'

# Wait for element
curl -X POST http://localhost:3456/wait \
  -H "Content-Type: application/json" \
  -d '{"selector": ".loaded", "timeout": 5000}'

# Press keyboard key
curl -X POST http://localhost:3456/keyboard \
  -H "Content-Type: application/json" \
  -d '{"key": "Enter"}'

# Select dropdown option
curl -X POST http://localhost:3456/select \
  -H "Content-Type: application/json" \
  -d '{"selector": "#country", "value": "us"}'

# Hover over element
curl -X POST http://localhost:3456/hover \
  -H "Content-Type: application/json" \
  -d '{"selector": ".menu-item"}'

# Scroll page
curl -X POST http://localhost:3456/scroll \
  -H "Content-Type: application/json" \
  -d '{"x": 0, "y": 500}'
```

### Page Info

```bash
# Get page title
curl http://localhost:3456/title

# Get current URL
curl http://localhost:3456/url

# Get page HTML content
curl http://localhost:3456/content
```

### Code Execution

```bash
# Execute inline JavaScript on the page (page.evaluate)
curl -X POST http://localhost:3456/execute/inline \
  -H "Content-Type: application/json" \
  -d '{"code": "document.title"}'

# Execute JavaScript that modifies the page
curl -X POST http://localhost:3456/execute/inline \
  -H "Content-Type: application/json" \
  -d '{"code": "document.body.style.background = \"red\"; return \"done\""}'

# Execute Playwright code with access to page/context/browser objects
curl -X POST http://localhost:3456/script/execute-playwright \
  -H "Content-Type: application/json" \
  -d '{"code": "await page.click(\"#increment\"); return await page.textContent(\"#counter-value\");"}'
```

### Page Management

```bash
# List all open pages
curl http://localhost:3456/pages

# Switch to a specific page by index
curl -X POST http://localhost:3456/pages/switch \
  -H "Content-Type: application/json" \
  -d '{"index": 1}'

# Switch to the most recently opened page
curl -X POST http://localhost:3456/pages/switch-latest
```

### Network Interception

Intercept and mock network requests by URL pattern. Useful for testing error states, simulating slow networks, or providing fake API responses.

```bash
# Add interception rule
curl -X POST http://localhost:3456/intercept/add \
  -H "Content-Type: application/json" \
  -d '{
    "id": "mock-users-api",
    "urlPattern": ".*\\/api\\/users.*",
    "method": "GET",
    "response": {
      "status": 200,
      "body": "{\"users\": [{\"id\": 1, \"name\": \"John\"}]}",
      "headers": {
        "content-type": "application/json"
      }
    }
  }'

# Mock a 404 error
curl -X POST http://localhost:3456/intercept/add \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-not-found",
    "urlPattern": ".*\\/api\\/user\\/123",
    "response": {
      "status": 404,
      "body": "{\"error\": \"User not found\"}"
    }
  }'

# Simulate slow API (3 second delay)
curl -X POST http://localhost:3456/intercept/add \
  -H "Content-Type: application/json" \
  -d '{
    "id": "slow-api",
    "urlPattern": ".*\\/api\\/.*",
    "delay": 3000,
    "response": {
      "status": 200,
      "body": "{\"data\": \"slow response\"}"
    }
  }'

# Block requests (simulate network failure)
curl -X POST http://localhost:3456/intercept/add \
  -H "Content-Type: application/json" \
  -d '{
    "id": "block-analytics",
    "urlPattern": ".*google-analytics\\.com.*",
    "response": {
      "abort": true
    }
  }'

# List all rules (shows match counts)
curl http://localhost:3456/intercept/list

# Get interception status
curl http://localhost:3456/intercept/status

# Disable a specific rule
curl -X POST http://localhost:3456/intercept/toggle/mock-users-api \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Enable a specific rule
curl -X POST http://localhost:3456/intercept/toggle/mock-users-api \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Remove a specific rule
curl -X DELETE http://localhost:3456/intercept/remove/mock-users-api

# Clear all rules
curl -X DELETE http://localhost:3456/intercept/clear

# Temporarily disable all interception (keeps rules)
curl -X POST http://localhost:3456/intercept/disable

# Re-enable all interception
curl -X POST http://localhost:3456/intercept/enable
```

**Rule Fields:**
- `id` (optional): Unique identifier, auto-generated if not provided
- `urlPattern` (required): Regular expression to match URLs
- `method` (optional): HTTP method (GET, POST, etc.). Omit to match all methods
- `response` (required): Response configuration
  - `status`: HTTP status code (default: 200)
  - `body`: Response body as string
  - `headers`: Custom response headers
  - `abort`: Set to `true` to abort the request instead of fulfilling
- `delay` (optional): Delay in milliseconds before responding
- `enabled` (optional): Enable/disable rule (default: true)

### Activity Recording

The server automatically records browser activity (network requests, console messages, errors, navigation, dialogs). Use these endpoints to monitor what happens between commands.

```bash
# Get recording status
curl http://localhost:3456/activity/status

# Poll for new activity since a watermark (KEY ENDPOINT for monitoring)
# Returns entries with id > since, and a new watermark for next poll
curl "http://localhost:3456/activity/poll?since=0"

# Quick check if anything happened (lightweight status check)
curl "http://localhost:3456/activity/check?since=5"

# Get activity log with filters
curl "http://localhost:3456/activity/log?limit=100"
curl "http://localhost:3456/activity/log?types=network-request,network-response"
curl "http://localhost:3456/activity/log?since=10&limit=50"

# Get activity summary
curl http://localhost:3456/activity/summary

# Start recording (with optional body capture)
curl -X POST http://localhost:3456/activity/start \
  -H "Content-Type: application/json" \
  -d '{"captureNetworkBodies": true}'

# Stop recording
curl -X POST http://localhost:3456/activity/stop

# Clear activity log
curl -X DELETE http://localhost:3456/activity/log

# Configure auto-start behavior
curl -X POST http://localhost:3456/activity/config \
  -H "Content-Type: application/json" \
  -d '{"autoStart": false}'
```

**Activity Types:**
- `network-request` - Outgoing HTTP requests
- `network-response` - HTTP responses
- `network-failed` - Failed requests
- `console` - Console messages (log, warn, error, etc.)
- `page-error` - JavaScript errors
- `navigation` - Page navigation events
- `dialog` - Alert/confirm/prompt dialogs

### Script Management (File-based execution)

```bash
# Save a script file
curl -X POST http://localhost:3456/script/save \
  -H "Content-Type: application/json" \
  -d '{"name": "my-script", "code": "console.log(\"Hello from script!\");"}'

# Execute a saved script (runs with ts-node)
curl -X POST http://localhost:3456/script/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "my-script"}'
```

## Example Workflow

```bash
# 1. Start server (in one terminal)
npm run dev

# 2. Check status
curl http://localhost:3456/status

# 3. Navigate to test page
curl -X POST http://localhost:3456/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "file:///C:/t/books/playwright-server/test-page.html"}'

# 4. Fill form
curl -X POST http://localhost:3456/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "#username", "text": "testuser"}'

curl -X POST http://localhost:3456/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "#email", "text": "test@example.com"}'

# 5. Take screenshot
curl -X POST http://localhost:3456/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "form-filled"}'

# 6. Click submit
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "button[type=\"submit\"]"}'

# 7. Screenshot after submit
curl -X POST http://localhost:3456/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "form-submitted"}'
```

## Directories

- `scripts/` - Saved script files
- `screenshots/` - Captured screenshots
- `src/` - Server source code
