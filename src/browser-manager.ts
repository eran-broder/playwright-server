import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import type { BrowserStatus, BrowserStartOptions } from './types';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private onPageCreated?: (page: Page) => void;
  private extensionPath?: string;
  private userDataDir: string;
  private isPersistentContext = false;

  constructor() {
    // Default user data directory
    this.userDataDir = path.join(os.tmpdir(), 'playwright-server-profile');
  }

  setOnPageCreated(callback: (page: Page) => void): void {
    this.onPageCreated = callback;
  }

  async start(options: BrowserStartOptions = {}): Promise<void> {
    await this.stop();

    const headless = options.headless ?? false;
    this.extensionPath = options.extensionPath;

    if (options.userDataDir) {
      this.userDataDir = options.userDataDir;
    }

    // If extension path is provided, use launchPersistentContext
    if (this.extensionPath) {
      const args = [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
      ];

      this.context = await chromium.launchPersistentContext(this.userDataDir, {
        headless,
        args,
      });

      this.isPersistentContext = true;
      this.browser = null; // No separate browser object with persistent context

      // Get or create the first page
      const pages = this.context.pages();
      if (pages.length > 0) {
        this.page = pages[0];
      } else {
        this.page = await this.context.newPage();
      }
    } else {
      // Standard browser launch without extension
      this.browser = await chromium.launch({ headless });
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();
      this.isPersistentContext = false;
    }

    if (this.onPageCreated && this.page) {
      this.onPageCreated(this.page);
    }
  }

  async stop(): Promise<void> {
    if (this.isPersistentContext && this.context) {
      // For persistent context, close the context directly
      await this.context.close();
    } else if (this.browser) {
      // For standard browser, close the browser (which closes context and pages)
      await this.browser.close();
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isPersistentContext = false;
  }

  async restart(options?: BrowserStartOptions): Promise<void> {
    // If no options provided, use the current configuration
    const startOptions: BrowserStartOptions = options || {
      extensionPath: this.extensionPath,
      userDataDir: this.userDataDir,
    };
    await this.start(startOptions);
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
      hasBrowser: this.browser !== null || this.isPersistentContext,
      hasContext: this.context !== null,
      hasPage: this.page !== null,
      currentUrl: this.page?.url(),
      extensionPath: this.extensionPath,
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
