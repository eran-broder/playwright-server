# Playwright Server

A local HTTP server that gives AI agents (and humans) full browser control via simple curl commands. Built on Playwright, it exposes navigation, interaction, screenshots, accessibility snapshots, activity monitoring, and raw Playwright code execution through a clean REST API.

## Claude Code Plugin

Install as a Claude Code plugin to give Claude browser automation capabilities:

```
/plugin marketplace add eran-broder/playwright-server
/plugin install playwright-server@eran-broder-playwright-server
```

Then use the `/playwright-server:browse` skill or just ask Claude to browse - it will auto-detect when to use it.

## Setup

```bash
npm install
npx playwright install chromium
```

## Run

```bash
npm run dev
```

Server runs on `http://localhost:3456` (configurable via `PORT` env var).

## API Overview

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Browser** | `POST /browser/start\|stop\|restart` | Lifecycle management |
| **Navigation** | `POST /navigate`, `GET /url\|title` | Go to URLs, get current state |
| **Snapshot** | `GET /snapshot` | Accessibility tree as YAML (lightweight page understanding) |
| **Interaction** | `POST /click\|type\|hover\|select\|keyboard\|scroll\|wait` | Page interactions |
| **Screenshots** | `POST /screenshot`, `GET /screenshots` | Capture and list screenshots |
| **Content** | `GET /content` | Full page HTML |
| **Code Exec** | `POST /execute/inline`, `POST /script/execute-playwright` | Run JS or Playwright code |
| **Activity** | `GET /activity/poll\|check\|log\|summary` | Network, console, error monitoring |
| **Pages** | `GET /pages`, `POST /pages/switch\|switch-latest` | Multi-tab management |

## Key Features

### Accessibility Snapshots

Get a structured YAML accessibility tree - 2-5KB vs 50-500KB for raw HTML:

```bash
curl http://localhost:3456/snapshot
curl "http://localhost:3456/snapshot?selector=nav"
```

```yaml
- heading "Login" [level=1]
- textbox "Email" [focused]
- textbox "Password"
- button "Sign In"
```

### Activity Recording

All browser events (network, console, errors, navigation, dialogs) are captured with incrementing IDs. Poll efficiently with watermarks:

```bash
# Get everything + initial watermark
curl "http://localhost:3456/activity/poll?since=0"

# After performing actions, get only new events
curl "http://localhost:3456/activity/poll?since=150"
```

### Playwright Code Execution

Full access to Playwright's `page`, `context`, and `browser` objects - anything Playwright can do, this server can do:

```bash
curl -X POST http://localhost:3456/script/execute-playwright \
  -H "Content-Type: application/json" \
  -d '{"code": "await page.waitForSelector(\".loaded\"); return await page.title();"}'
```

### Auth State Persistence

Drop an `auth.json` file in the project root (Playwright storage state format) and it auto-loads on browser start, restoring cookies and localStorage.

## Quick Example

```bash
# Navigate
curl -X POST http://localhost:3456/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# See what's on the page
curl http://localhost:3456/snapshot

# Click something
curl -X POST http://localhost:3456/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "a"}'

# Check what happened (network, errors, console)
curl "http://localhost:3456/activity/poll?since=0"

# Take a screenshot
curl -X POST http://localhost:3456/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "after-click"}'
```

## Documentation

- **[AI Agent Guide](README-AI-AGENT.md)** - Complete API reference with response shapes, activity types, workflows, and best practices
- **[Skill Instructions](skills/browse/SKILL.md)** - Compact reference used by the Claude Code plugin

## Project Structure

```
playwright-server/
├── .claude-plugin/       # Claude Code plugin manifest
│   └── plugin.json
├── skills/browse/        # Claude Code skill definition
│   └── SKILL.md
├── src/                  # Server source code
│   ├── server.ts         # Express routes
│   ├── browser-manager.ts
│   ├── activity-recorder.ts
│   ├── screenshot-manager.ts
│   ├── script-manager.ts
│   ├── file-manager.ts   # Generic base class
│   └── types.ts
├── screenshots/          # Captured screenshots (gitignored)
├── scripts/              # Saved scripts (gitignored)
└── auth.json             # Browser auth state (gitignored, optional)
```
