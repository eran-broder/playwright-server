import * as fs from 'fs';
import * as path from 'path';
import { chromium, devices, Browser, BrowserContext, Page } from 'playwright';
import type { BrowserStatus } from './types';
import {
  BrowserKind,
  ProfileMode,
  Channel,
  channelFor,
  prepareUserDataDir,
  CRITICAL_PROFILE_FILES,
} from './profile-finder';

export interface StartOptions {
  device?: string;
  browser?: BrowserKind;
  profile?: string;
  profileMode?: ProfileMode;
  userDataDir?: string;
}

type DeviceConfig = Parameters<Browser['newContext']>[0];

const removeUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

const isPersistentMode = (opts: StartOptions): boolean =>
  Boolean(opts.profile || opts.userDataDir);

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private onPageCreated?: (page: Page) => void;
  private currentDevice: string | null = null;
  private currentOpts: StartOptions = {};

  setOnPageCreated(callback: (page: Page) => void): void {
    this.onPageCreated = callback;
  }

  async start(opts: StartOptions = {}): Promise<void> {
    await this.stop();
    this.currentOpts = opts;

    const channel = opts.browser ? channelFor(opts.browser) : undefined;
    const deviceConfig = this.resolveDeviceConfig(opts.device);

    if (isPersistentMode(opts)) {
      await this.startPersistent(opts, channel, deviceConfig);
    } else {
      await this.startEphemeral(channel, deviceConfig);
    }

    if (this.onPageCreated && this.page) {
      this.onPageCreated(this.page);
    }
  }

  async stop(): Promise<void> {
    if (this.context && !this.browser) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.currentDevice = null;
  }

  async restart(opts: StartOptions = {}): Promise<void> {
    const overrides = removeUndefined(opts as Record<string, unknown>) as StartOptions;
    await this.start({ ...this.currentOpts, ...overrides });
  }

  getCurrentDevice(): string | null {
    return this.currentDevice;
  }

  getPage(): Page | null {
    return this.page;
  }

  getContext(): BrowserContext | null {
    return this.context;
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  isReady(): boolean {
    return this.page !== null;
  }

  getStatus(): BrowserStatus {
    return {
      hasBrowser: this.context !== null,
      hasContext: this.context !== null,
      hasPage: this.page !== null,
      currentUrl: this.page?.url(),
    };
  }

  requirePage(): Page {
    if (!this.page) {
      throw new Error('Browser not started');
    }
    return this.page;
  }

  async navigate(url: string): Promise<void> {
    const page = this.requirePage();
    await page.goto(url, { waitUntil: 'networkidle' });
  }

  async screenshot(path: string, fullPage: boolean): Promise<void> {
    const page = this.requirePage();
    await page.screenshot({ path, fullPage });
  }

  async click(selector: string): Promise<void> {
    const page = this.requirePage();
    await page.click(selector);
  }

  async type(selector: string, text: string): Promise<void> {
    const page = this.requirePage();
    await page.fill(selector, text);
  }

  async waitForSelector(selector: string, timeout: number): Promise<void> {
    const page = this.requirePage();
    await page.waitForSelector(selector, { timeout });
  }

  async getContent(): Promise<string> {
    const page = this.requirePage();
    return page.content();
  }

  async getTitle(): Promise<string> {
    const page = this.requirePage();
    return page.title();
  }

  getUrl(): string {
    const page = this.requirePage();
    return page.url();
  }

  async pressKey(key: string): Promise<void> {
    const page = this.requirePage();
    await page.keyboard.press(key);
  }

  async selectOption(selector: string, value: string): Promise<void> {
    const page = this.requirePage();
    await page.selectOption(selector, value);
  }

  async hover(selector: string): Promise<void> {
    const page = this.requirePage();
    await page.hover(selector);
  }

  async snapshot(selector?: string): Promise<string> {
    const page = this.requirePage();
    const locator = selector ? page.locator(selector) : page.locator('body');
    return locator.ariaSnapshot();
  }

  async scroll(x: number, y: number): Promise<void> {
    const page = this.requirePage();
    await page.evaluate(`window.scrollBy(${x}, ${y})`);
  }

  async evaluate<T>(code: string): Promise<T> {
    const page = this.requirePage();
    return page.evaluate(code) as Promise<T>;
  }

  async executePlaywrightCode<T>(code: string): Promise<T> {
    const page = this.requirePage();
    const context = this.context;
    const browser = this.browser;

    const asyncFn = new Function(
      'page',
      'context',
      'browser',
      `return (async () => { ${code} })();`,
    );

    return asyncFn(page, context, browser) as Promise<T>;
  }

  async listPages(): Promise<{ index: number; url: string; title: string }[]> {
    if (!this.context) return [];
    const pages = this.context.pages();
    const result = [];
    for (let i = 0; i < pages.length; i++) {
      result.push({
        index: i,
        url: pages[i].url(),
        title: await pages[i].title(),
      });
    }
    return result;
  }

  async switchToPage(index: number): Promise<void> {
    if (!this.context) throw new Error('No browser context');
    const pages = this.context.pages();
    if (index < 0 || index >= pages.length) {
      throw new Error(`Invalid page index: ${index}. Available: 0-${pages.length - 1}`);
    }
    this.page = pages[index];
    if (this.onPageCreated) {
      this.onPageCreated(this.page);
    }
  }

  async switchToLatestPage(): Promise<void> {
    if (!this.context) throw new Error('No browser context');
    const pages = this.context.pages();
    if (pages.length > 0) {
      this.page = pages[pages.length - 1];
      if (this.onPageCreated) {
        this.onPageCreated(this.page);
      }
    }
  }

  private resolveDeviceConfig(device?: string): DeviceConfig {
    if (!device) {
      this.currentDevice = null;
      return {};
    }
    const d = devices[device];
    if (!d) {
      throw new Error(`Unknown device: ${device}. Try "iPhone 14", "Pixel 7", etc.`);
    }
    this.currentDevice = device;
    return { ...d };
  }

  private async startEphemeral(channel: Channel, deviceConfig: DeviceConfig): Promise<void> {
    this.browser = await chromium.launch({ headless: false, channel });
    const authPath = process.env.AUTH_PATH || path.join(process.cwd(), 'auth.json');
    if (fs.existsSync(authPath)) {
      console.log('Loading auth state from ' + authPath);
      const state = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      this.context = await this.browser.newContext({ ...deviceConfig, storageState: state });
    } else {
      this.context = await this.browser.newContext(deviceConfig);
    }
    this.page = await this.context.newPage();
  }

  private async startPersistent(
    opts: StartOptions,
    channel: Channel,
    deviceConfig: DeviceConfig,
  ): Promise<void> {
    const browser = opts.browser ?? BrowserKind.Chromium;
    const profile = opts.profile ?? 'Default';
    const mode = opts.profileMode ?? ProfileMode.Copy;
    const setup = await prepareUserDataDir(browser, profile, mode, process.cwd(), opts.userDataDir);
    console.log(`Launching ${browser} with profile "${profile}" (${mode}) at ${setup.userDataDir}`);
    warnSkippedCriticalFiles(setup.skipped, browser);

    this.context = await chromium.launchPersistentContext(setup.userDataDir, {
      headless: false,
      channel,
      args: [setup.profileArg],
      ...deviceConfig,
    });
    this.browser = this.context.browser();
    const existing = this.context.pages();
    this.page = existing[0] ?? (await this.context.newPage());
  }
}

const warnSkippedCriticalFiles = (skipped: string[], browser: BrowserKind): void => {
  const critical = skipped.filter((p) => CRITICAL_PROFILE_FILES.includes(path.basename(p)));
  if (critical.length === 0) return;
  console.warn(
    `[warning] Could not copy ${critical.length} critical file(s) — likely locked by a running ${browser} instance:`,
  );
  for (const p of critical) console.warn(`  ${p}`);
  console.warn(`Close ${browser} fully and restart the server for cookies/logins to transfer.`);
};
