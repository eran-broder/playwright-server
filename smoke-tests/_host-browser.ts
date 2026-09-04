import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { browserPid } from './_helpers';

declare const chrome: {
  storage: { local: { set(items: Record<string, string>): Promise<void> } };
};

const { values } = parseArgs({
  options: {
    extension: { type: 'boolean', default: false },
    token: { type: 'string' },
    label: { type: 'string', default: 'smoke' },
    'debug-port': { type: 'string' },
    url: { type: 'string', default: 'data:text/html,<title>host-tab</title><h1>host</h1>' },
  },
});

const extensionDir = path.resolve(__dirname, '..', 'extension');
const withExtension = values.extension || values.token !== undefined;
const extensionArgs = withExtension
  ? [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`]
  : [];
const debugArgs = values['debug-port'] ? [`--remote-debugging-port=${values['debug-port']}`] : [];

const awaitWorker = async (ctx: import('playwright').BrowserContext): Promise<import('playwright').Worker> => {
  ctx.on('console', (msg) => console.log(`[sw] ${msg.text()}`));
  return ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
};

const seedPairing = async (worker: import('playwright').Worker, token: string, label: string): Promise<void> => {
  await worker.evaluate(
    async (settings: Record<string, string>) => { await chrome.storage.local.set(settings); },
    { token, label },
  );
};

const main = async (): Promise<void> => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwhs-host-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: !withExtension,
    args: [...extensionArgs, ...debugArgs],
  });
  if (withExtension) {
    const worker = await awaitWorker(ctx);
    if (values.token) await seedPairing(worker, values.token, values.label);
  }
  await ctx.pages()[0].goto(values.url);
  console.log(`BROWSER_PID=${await browserPid(ctx)}`);
  console.log('READY');
  await new Promise(() => undefined);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
