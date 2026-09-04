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
    token: { type: 'string' },
    label: { type: 'string', default: 'smoke' },
    'debug-port': { type: 'string' },
    url: { type: 'string', default: 'data:text/html,<title>host-tab</title><h1>host</h1>' },
  },
});

const extensionDir = path.resolve(__dirname, '..', 'extension');
const extensionArgs = values.token
  ? [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`]
  : [];
const debugArgs = values['debug-port'] ? [`--remote-debugging-port=${values['debug-port']}`] : [];

const pairExtension = async (ctx: import('playwright').BrowserContext, token: string, label: string): Promise<void> => {
  const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  ctx.on('console', (msg) => console.log(`[sw] ${msg.text()}`));
  await worker.evaluate(
    async (settings: Record<string, string>) => { await chrome.storage.local.set(settings); },
    { token, label },
  );
};

const main = async (): Promise<void> => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwhs-host-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: !values.token,
    args: [...extensionArgs, ...debugArgs],
  });
  if (values.token) await pairExtension(ctx, values.token, values.label);
  await ctx.pages()[0].goto(values.url);
  console.log(`BROWSER_PID=${await browserPid(ctx)}`);
  console.log('READY');
  await new Promise(() => undefined);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
