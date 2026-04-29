import * as fs from 'fs';
import * as path from 'path';
import { chromium, devices, Browser, BrowserContext, Page } from 'playwright';
import type { BrowserStatus } from './types';

export interface StartOptions {
  /** Playwright device name for emulation, e.g. "iPhone 14", "Pixel 7", "iPad Mini".
   *  Sets touch + mobile UA + viewport + DPR atomically. */
  device?: string;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private onPageCreated?: (page: Page) => void;
  private currentDevice: string | null = null;

  setOnPageCreated(callback: (page: Page) => void): void {
    this.onPageCreated = callback;
  }

  async start(opts: StartOptions = {}): Promise<void> {
    await this.stop();
    this.browser = await chromium.launch({ headless: false });

    let deviceConfig: Parameters<Browser['newContext']>[0] = {};
    if (opts.device) {
      const d = devices[opts.device];
      if (!d) throw new Error(`Unknown device: ${opts.device}. Try "iPhone 14", "Pixel 7", etc.`);
      deviceConfig = { ...d };
      this.currentDevice = opts.device;
    } else {
      this.currentDevice = null;
    }

    const authPath = process.env.AUTH_PATH || path.join(process.cwd(), 'auth.json');
    if (fs.existsSync(authPath)) {
        console.log('Loading auth state from ' + authPath);
        const state = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
        this.context = await this.browser.newContext({ ...deviceConfig, storageState: state });
    } else {
        this.context = await this.browser.newContext(deviceConfig);
    }

    this.page = await this.context.newPage();

    if (this.onPageCreated && this.page) {
      this.onPageCreated(this.page);
    }
  }

  async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.currentDevice = null;
  }

  async restart(opts: StartOptions = {}): Promise<void> {
    await this.start(opts);
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
      hasBrowser: this.browser !== null,
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
      `return (async () => { ${code} })();`
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
}
