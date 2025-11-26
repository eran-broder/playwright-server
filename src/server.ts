import express, { Request, Response, NextFunction } from 'express';
import * as path from 'path';

import { BrowserManager } from './browser-manager';
import { NetworkMonitor } from './network-monitor';
import { ScriptManager } from './script-manager';
import { ScreenshotManager } from './screenshot-manager';
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
  NetworkCaptureOptions,
  NetworkLogFilter,
} from './types';

// ============ Configuration ============

const config: ServerConfig = {
  port: 3456,
  scriptsDir: path.join(__dirname, '..', 'scripts'),
  screenshotsDir: path.join(__dirname, '..', 'screenshots'),
};

// ============ Initialize Services ============

const browserManager = new BrowserManager();
const networkMonitor = new NetworkMonitor();
const scriptManager = new ScriptManager(config.scriptsDir);
const screenshotManager = new ScreenshotManager(config.screenshotsDir);

browserManager.setOnPageCreated((page) => {
  networkMonitor.attach(page);
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
    network: networkMonitor.getState(),
    screenshotsDir: screenshotManager.getDirectory(),
    scriptsDir: config.scriptsDir,
  });
});

// ============ Browser Endpoints ============

app.post('/browser/start', asyncHandler(async (_req: Request, res: Response) => {
  await browserManager.start();
  res.json({ success: true, message: 'Browser started' });
}));

app.post('/browser/stop', asyncHandler(async (_req: Request, res: Response) => {
  await browserManager.stop();
  res.json({ success: true, message: 'Browser stopped' });
}));

app.post('/browser/restart', asyncHandler(async (_req: Request, res: Response) => {
  await browserManager.restart();
  res.json({ success: true, message: 'Browser restarted' });
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

// ============ Network Monitoring Endpoints ============

app.post('/network/start', (_req: Request, res: Response) => {
  const { captureBody = false } = _req.body as NetworkCaptureOptions;
  networkMonitor.start(captureBody);
  res.json({
    success: true,
    message: 'Network capture started',
    captureBody,
  });
});

app.post('/network/stop', (_req: Request, res: Response) => {
  const entriesCaptured = networkMonitor.stop();
  res.json({
    success: true,
    message: 'Network capture stopped',
    entriesCaptured,
  });
});

app.get('/network/status', (_req: Request, res: Response) => {
  res.json(networkMonitor.getState());
});

app.get('/network/log', (req: Request, res: Response) => {
  const filter: NetworkLogFilter = {
    type: req.query.type as NetworkLogFilter['type'],
    resourceType: req.query.resourceType as string,
    urlPattern: req.query.urlPattern as string,
    method: req.query.method as string,
    status: req.query.status ? Number(req.query.status) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : 1000,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  };

  const { total, entries } = networkMonitor.getEntries(filter);
  res.json({
    success: true,
    total,
    offset: filter.offset,
    limit: filter.limit,
    returned: entries.length,
    entries,
  });
});

app.get('/network/summary', (_req: Request, res: Response) => {
  res.json({ success: true, ...networkMonitor.getSummary() });
});

app.delete('/network/log', (_req: Request, res: Response) => {
  const cleared = networkMonitor.clear();
  res.json({ success: true, cleared });
});

app.get('/network/har', (_req: Request, res: Response) => {
  const har = networkMonitor.exportHar();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="network.har"');
  res.json(har);
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
  console.log('  POST /browser/start             - Start browser');
  console.log('  POST /browser/stop              - Stop browser');
  console.log('  POST /browser/restart           - Restart browser');
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
  console.log('Network Monitoring:');
  console.log('  POST /network/start             - Start capture {captureBody?}');
  console.log('  POST /network/stop              - Stop capture');
  console.log('  GET  /network/status            - Capture status');
  console.log('  GET  /network/log               - Get log (filters: type, resourceType, urlPattern, method, status, limit, offset)');
  console.log('  GET  /network/summary           - Get traffic summary');
  console.log('  DEL  /network/log               - Clear log');
  console.log('  GET  /network/har               - Export as HAR');
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
