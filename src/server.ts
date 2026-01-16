import express, { Request, Response, NextFunction } from 'express';
import * as path from 'path';

import { BrowserManager } from './browser-manager';
import { ActivityRecorder } from './activity-recorder';
import { ScriptManager } from './script-manager';
import { ScreenshotManager } from './screenshot-manager';
import { InterceptManager } from './intercept-manager';
import type {
  ServerConfig,
  NavigateOptions,
  ScreenshotOptions,
  ClickOptions,
  TypeOptions,
  WaitOptions,
  SelectOptions,
  HoverOptions,
  ScrollOptions,
  KeyboardOptions,
  SaveScriptOptions,
  ActivityType,
  ActivityFilter,
  AddInterceptRuleOptions,
  BrowserStartOptions,
} from './types';

// ============ Configuration ============

const config: ServerConfig = {
  port: 3456,
  scriptsDir: path.join(__dirname, '..', 'scripts'),
  screenshotsDir: path.join(__dirname, '..', 'screenshots'),
};

// ============ Initialize Services ============

const browserManager = new BrowserManager();
const activityRecorder = new ActivityRecorder();
const scriptManager = new ScriptManager(config.scriptsDir);
const screenshotManager = new ScreenshotManager(config.screenshotsDir);
const interceptManager = new InterceptManager();

browserManager.setOnPageCreated((page) => {
  activityRecorder.attach(page);
  interceptManager.attach(page);
});

// ============ Express App ============

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));

// ============ Error Handler ============

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, error: err.message });
}

// ============ Status Endpoint ============

app.get('/status', (_req: Request, res: Response) => {
  const status = browserManager.getStatus();
  res.json({
    server: 'running',
    browser: status.hasBrowser,
    page: status.hasPage,
    currentUrl: status.currentUrl,
    recording: activityRecorder.getState(),
    screenshotsDir: screenshotManager.getDirectory(),
    scriptsDir: config.scriptsDir,
  });
});

// ============ Browser Endpoints ============

app.post('/browser/start', asyncHandler(async (req: Request, res: Response) => {
  const options = req.body as BrowserStartOptions;
  await browserManager.start(options);
  const status = browserManager.getStatus();
  res.json({
    success: true,
    message: 'Browser started',
    extensionPath: status.extensionPath
  });
}));

app.post('/browser/stop', asyncHandler(async (_req: Request, res: Response) => {
  await browserManager.stop();
  res.json({ success: true, message: 'Browser stopped' });
}));

app.post('/browser/restart', asyncHandler(async (req: Request, res: Response) => {
  const options = req.body as BrowserStartOptions;
  await browserManager.restart(options);
  const status = browserManager.getStatus();
  res.json({
    success: true,
    message: 'Browser restarted',
    extensionPath: status.extensionPath
  });
}));

// ============ Navigation Endpoints ============

app.post('/navigate', asyncHandler(async (req: Request, res: Response) => {
  const { url } = req.body as NavigateOptions;
  await browserManager.navigate(url);
  res.json({ success: true, url });
}));

// ============ Screenshot Endpoints ============

app.post('/screenshot', asyncHandler(async (req: Request, res: Response) => {
  const { name, fullPage = true } = req.body as ScreenshotOptions;
  const screenshotName = name || screenshotManager.generateName();
  const filepath = screenshotManager.getFilepath(screenshotName);
  await browserManager.screenshot(filepath, fullPage);
  const result = screenshotManager.getResult(screenshotName);
  res.json({ success: true, ...result });
}));

app.get('/screenshot/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  if (screenshotManager.exists(name)) {
    res.sendFile(screenshotManager.getFilepath(name));
  } else {
    res.status(404).json({ success: false, error: 'Screenshot not found' });
  }
});

app.get('/screenshots', (_req: Request, res: Response) => {
  res.json({ success: true, screenshots: screenshotManager.list() });
});

// ============ Code Execution Endpoints ============

app.post('/execute/inline', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const result = await browserManager.evaluate(code);
  res.json({ success: true, result });
}));

app.post('/script/save', (_req: Request, res: Response) => {
  const { name, code } = _req.body as SaveScriptOptions;
  const result = scriptManager.save(name, code);
  res.json({ success: true, ...result });
});

app.post('/script/execute', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as { name: string };
  const result = await scriptManager.execute(name);
  res.json({ success: true, ...result });
}));

app.post('/script/execute-playwright', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const result = await browserManager.executePlaywrightCode(code);
  res.json({ success: true, result });
}));

// ============ Page Interaction Endpoints ============

app.post('/click', asyncHandler(async (req: Request, res: Response) => {
  const { selector } = req.body as ClickOptions;
  await browserManager.click(selector);
  res.json({ success: true });
}));

app.post('/type', asyncHandler(async (req: Request, res: Response) => {
  const { selector, text } = req.body as TypeOptions;
  await browserManager.type(selector, text);
  res.json({ success: true });
}));

app.post('/wait', asyncHandler(async (req: Request, res: Response) => {
  const { selector, timeout = 30000 } = req.body as WaitOptions;
  await browserManager.waitForSelector(selector, timeout);
  res.json({ success: true });
}));

app.get('/content', asyncHandler(async (_req: Request, res: Response) => {
  const content = await browserManager.getContent();
  res.json({ success: true, content });
}));

app.get('/title', asyncHandler(async (_req: Request, res: Response) => {
  const title = await browserManager.getTitle();
  res.json({ success: true, title });
}));

app.get('/url', (_req: Request, res: Response) => {
  const url = browserManager.getUrl();
  res.json({ success: true, url });
});

app.post('/keyboard', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.body as KeyboardOptions;
  await browserManager.pressKey(key);
  res.json({ success: true });
}));

app.post('/select', asyncHandler(async (req: Request, res: Response) => {
  const { selector, value } = req.body as SelectOptions;
  await browserManager.selectOption(selector, value);
  res.json({ success: true });
}));

app.post('/hover', asyncHandler(async (req: Request, res: Response) => {
  const { selector } = req.body as HoverOptions;
  await browserManager.hover(selector);
  res.json({ success: true });
}));

app.post('/scroll', asyncHandler(async (req: Request, res: Response) => {
  const { x = 0, y = 0 } = req.body as ScrollOptions;
  await browserManager.scroll(x, y);
  res.json({ success: true });
}));

// ============ Page Management Endpoints ============

app.get('/pages', asyncHandler(async (_req: Request, res: Response) => {
  const pages = await browserManager.listPages();
  res.json({ success: true, pages });
}));

app.post('/pages/switch', asyncHandler(async (req: Request, res: Response) => {
  const { index } = req.body as { index: number };
  await browserManager.switchToPage(index);
  res.json({ success: true, message: `Switched to page ${index}` });
}));

app.post('/pages/switch-latest', asyncHandler(async (_req: Request, res: Response) => {
  await browserManager.switchToLatestPage();
  res.json({ success: true, message: 'Switched to latest page' });
}));

// ============ Network Interception Endpoints ============

// Add interception rule
app.post('/intercept/add', (req: Request, res: Response) => {
  try {
    const options = req.body as AddInterceptRuleOptions;
    const rule = interceptManager.addRule(options);
    res.json({ success: true, rule });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List all rules
app.get('/intercept/list', (_req: Request, res: Response) => {
  const rules = interceptManager.listRules();
  res.json({ success: true, rules });
});

// Remove specific rule
app.delete('/intercept/remove/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const removed = interceptManager.removeRule(id);
  if (removed) {
    res.json({ success: true, message: `Rule '${id}' removed` });
  } else {
    res.status(404).json({ success: false, error: `Rule '${id}' not found` });
  }
});

// Clear all rules
app.delete('/intercept/clear', (_req: Request, res: Response) => {
  const removed = interceptManager.clearRules();
  res.json({ success: true, removed, message: `Cleared ${removed} rule(s)` });
});

// Toggle specific rule
app.post('/intercept/toggle/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body as { enabled: boolean };
    const rule = interceptManager.toggleRule(id, enabled);
    res.json({ success: true, rule });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enable all interception
app.post('/intercept/enable', (_req: Request, res: Response) => {
  interceptManager.setEnabled(true);
  res.json({ success: true, message: 'Interception enabled' });
});

// Disable all interception
app.post('/intercept/disable', (_req: Request, res: Response) => {
  interceptManager.setEnabled(false);
  res.json({ success: true, message: 'Interception disabled' });
});

// Get interception status
app.get('/intercept/status', (_req: Request, res: Response) => {
  const status = interceptManager.getStatus();
  res.json({ success: true, ...status });
});

// ============ Activity Recording Endpoints ============

// Start recording (recording is auto-started by default)
app.post('/activity/start', (_req: Request, res: Response) => {
  const { captureNetworkBodies = false } = _req.body as { captureNetworkBodies?: boolean };
  activityRecorder.start({ captureNetworkBodies });
  res.json({
    success: true,
    message: 'Recording started',
    state: activityRecorder.getState(),
  });
});

// Stop recording
app.post('/activity/stop', (_req: Request, res: Response) => {
  const entriesCaptured = activityRecorder.stop();
  res.json({
    success: true,
    message: 'Recording stopped',
    entriesCaptured,
  });
});

// Get recording state
app.get('/activity/status', (_req: Request, res: Response) => {
  res.json({ success: true, ...activityRecorder.getState() });
});

// Quick status check - ideal for polling to see if anything happened
app.get('/activity/check', (req: Request, res: Response) => {
  const since = req.query.since ? Number(req.query.since) : undefined;
  const status = activityRecorder.getQuickStatus(since);
  res.json({ success: true, ...status });
});

// Poll for new activity since watermark - THE KEY ENDPOINT
// Use this between commands to see what happened
app.get('/activity/poll', (req: Request, res: Response) => {
  const since = req.query.since ? Number(req.query.since) : 0;
  const typesParam = req.query.types as string | undefined;
  const types = typesParam ? typesParam.split(',') as ActivityType[] : undefined;

  const result = activityRecorder.poll(since, types);
  res.json({
    success: true,
    ...result,
  });
});

// Get activity entries with filtering
app.get('/activity/log', (req: Request, res: Response) => {
  const filter: ActivityFilter = {
    since: req.query.since ? Number(req.query.since) : undefined,
    types: req.query.types ? (req.query.types as string).split(',') as ActivityType[] : undefined,
    limit: req.query.limit ? Number(req.query.limit) : 1000,
  };

  const result = activityRecorder.getEntries(filter);
  res.json({
    success: true,
    ...result,
  });
});

// Get activity summary
app.get('/activity/summary', (_req: Request, res: Response) => {
  res.json({ success: true, ...activityRecorder.getSummary() });
});

// Clear activity log
app.delete('/activity/log', (_req: Request, res: Response) => {
  const cleared = activityRecorder.clear();
  res.json({ success: true, cleared });
});

// Configure auto-start behavior
app.post('/activity/config', (_req: Request, res: Response) => {
  const { autoStart } = _req.body as { autoStart?: boolean };
  if (autoStart !== undefined) {
    activityRecorder.setAutoStart(autoStart);
  }
  res.json({ success: true, state: activityRecorder.getState() });
});

// ============ Static Files ============

app.use('/static/screenshots', express.static(screenshotManager.getDirectory()));

// ============ Error Handler ============

app.use(errorHandler);

// ============ Server Startup ============

function printEndpoints(): void {
  console.log('API Endpoints:');
  console.log('  GET  /status                    - Server status');
  console.log('');
  console.log('Browser:');
  console.log('  POST /browser/start             - Start browser {extensionPath?, userDataDir?, headless?}');
  console.log('  POST /browser/stop              - Stop browser');
  console.log('  POST /browser/restart           - Restart browser {extensionPath?, userDataDir?, headless?}');
  console.log('');
  console.log('Navigation:');
  console.log('  POST /navigate                  - Navigate to URL {url}');
  console.log('');
  console.log('Screenshots:');
  console.log('  POST /screenshot                - Take screenshot {name?, fullPage?}');
  console.log('  GET  /screenshot/:name          - Get screenshot image');
  console.log('  GET  /screenshots               - List screenshots');
  console.log('');
  console.log('Code Execution:');
  console.log('  POST /execute/inline            - Execute JS on page {code}');
  console.log('  POST /script/save               - Save script {name, code}');
  console.log('  POST /script/execute            - Run saved script {name}');
  console.log('  POST /script/execute-playwright - Execute Playwright code {code}');
  console.log('');
  console.log('Page Interaction:');
  console.log('  POST /click                     - Click element {selector}');
  console.log('  POST /type                      - Type text {selector, text}');
  console.log('  POST /wait                      - Wait for selector {selector, timeout?}');
  console.log('  GET  /content                   - Get page HTML');
  console.log('  GET  /title                     - Get page title');
  console.log('  GET  /url                       - Get current URL');
  console.log('  POST /keyboard                  - Press key {key}');
  console.log('  POST /select                    - Select option {selector, value}');
  console.log('  POST /hover                     - Hover element {selector}');
  console.log('  POST /scroll                    - Scroll page {x?, y?}');
  console.log('');
  console.log('Network Interception (mock API responses, block requests):');
  console.log('  POST /intercept/add             - Add interception rule {urlPattern, response, ...}');
  console.log('  GET  /intercept/list            - List all rules');
  console.log('  DEL  /intercept/remove/:id      - Remove specific rule');
  console.log('  DEL  /intercept/clear           - Clear all rules');
  console.log('  POST /intercept/toggle/:id      - Enable/disable rule {enabled}');
  console.log('  POST /intercept/enable          - Enable all interception');
  console.log('  POST /intercept/disable         - Disable all interception');
  console.log('  GET  /intercept/status          - Get interception status');
  console.log('');
  console.log('Activity Recording (auto-starts, captures network + console + errors):');
  console.log('  GET  /activity/poll?since=N     - Poll new events since watermark N (KEY ENDPOINT)');
  console.log('  GET  /activity/check?since=N    - Quick check if anything happened');
  console.log('  GET  /activity/log              - Get activity log (filters: since, types, limit)');
  console.log('  GET  /activity/summary          - Get activity summary');
  console.log('  GET  /activity/status           - Recording state');
  console.log('  POST /activity/start            - Start recording {captureNetworkBodies?}');
  console.log('  POST /activity/stop             - Stop recording');
  console.log('  POST /activity/config           - Configure {autoStart?}');
  console.log('  DEL  /activity/log              - Clear log');
  console.log('');
}

async function main(): Promise<void> {
  app.listen(config.port, async () => {
    console.log(`Playwright Server running on http://localhost:${config.port}`);
    console.log('');
    printEndpoints();
    await browserManager.start();
    console.log('Browser initialized');
  });
}

main().catch(console.error);
