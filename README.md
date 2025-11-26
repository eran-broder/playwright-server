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

# Start browser
curl -X POST http://localhost:3456/browser/start

# Stop browser
curl -X POST http://localhost:3456/browser/stop

# Restart browser
curl -X POST http://localhost:3456/browser/restart
```

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
