import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { browserPid } from './_helpers';

declare const chrome: {
  storage: { local: { set(items: Record<string, string>): Promise<void> } };
};
declare const pwhs: { mintCode(ttl: number | null | string, name?: string): Promise<string> };

const { values } = parseArgs({
  options: {
    extension: { type: 'boolean', default: false },
    label: { type: 'string', default: 'smoke' },
    mint: { type: 'string' },
    'debug-port': { type: 'string' },
    url: { type: 'string', default: 'data:text/html,<title>host-tab</title><h1>host</h1>' },
  },
});

const extensionDir = path.resolve(__dirname, '..', 'extension');
const withExtension = values.extension || values.mint !== undefined;
const extensionArgs = withExtension
  ? [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`]
  : [];
const debugArgs = values['debug-port'] ? [`--remote-debugging-port=${values['debug-port']}`] : [];

const awaitWorker = async (ctx: import('playwright').BrowserContext): Promise<import('playwright').Worker> => {
  ctx.on('console', (msg) => console.log(`[sw] ${msg.text()}`));
  return ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
};

const NEVER = 'never';

const ttlOf = (mint: string): number | null | string => {
  if (/^-?\d+$/.test(mint)) return Number(mint);
  return mint === NEVER ? null : mint;
};

const seedProfile = async (worker: import('playwright').Worker, label: string, mint?: string): Promise<void> => {
  await worker.evaluate(async (settings: Record<string, string>) => { await chrome.storage.local.set(settings); }, { label });
  if (mint === undefined) return;
  const code = await worker.evaluate((ttl: number | null | string) => pwhs.mintCode(ttl, 'smoke'), ttlOf(mint));
  console.log(`PAIR_CODE=${code}`);
};

const main = async (): Promise<void> => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwhs-host-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: !withExtension,
    args: [...extensionArgs, ...debugArgs],
  });
  if (withExtension) {
    const worker = await awaitWorker(ctx);
    await seedProfile(worker, values.label, values.mint);
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
