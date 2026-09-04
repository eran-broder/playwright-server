import { devices, Browser, BrowserContext, Locator, Page } from 'playwright';
import type { BrowserStatus, PageInfo, SnapshotOptions } from './types';
import { WaitUntil } from './types';
import { BrowserKind, ProfileMode, channelFor } from './profile-finder';
import { CdpBridge } from './cdp-bridge';
import { EMULATED_VIEWPORT, ViewportMode } from './viewport';
import {
  DeviceConfig,
  Launched,
  LaunchMode,
  connectAttached,
  launchEphemeral,
  launchPersistent,
} from './launchers';
import { ExtensionDriver } from './extension-driver';
import type { Relay } from './relay/relay';

export { LaunchMode };

export interface StartOptions {
  device?: string;
  viewport?: ViewportMode;
  browser?: BrowserKind;
  profile?: string;
  profileMode?: ProfileMode;
  userDataDir?: string;
  attach?: string;
  extension?: boolean;
  window?: number;
  tab?: number;
}

export interface TraceStartOptions {
  screenshots?: boolean;
  snapshots?: boolean;
}

export type ClockTime = number | string;

type GotoWaitUntil = NonNullable<Parameters<Page['goto']>[1]>['waitUntil'];
type AriaSnapshotOptions = Parameters<Locator['ariaSnapshot']>[0];

const EXTENSION_CONNECT_TIMEOUT_MS = 100_000;

const removeUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

const toGotoWaitUntil = (w: WaitUntil): GotoWaitUntil => (w as string) as GotoWaitUntil;

const isPersistentMode = (opts: StartOptions): boolean =>
  Boolean(opts.profile || opts.userDataDir);

const effectiveViewport = (opts: StartOptions): ViewportMode =>
  opts.viewport ?? (opts.extension ? ViewportMode.Window : ViewportMode.Emulated);

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private onPageCreated?: (page: Page) => void;
  private currentDevice: string | null = null;
  private currentOpts: StartOptions = {};
  private mode: LaunchMode | null = null;
  private extension: ExtensionDriver | null = null;
  private cdp = new CdpBridge();

  constructor(private readonly relay: Relay | null = null) {}

  setOnPageCreated(callback: (page: Page) => void): void {
    this.onPageCreated = callback;
  }

  async start(opts: StartOptions = {}): Promise<void> {
    await this.stop();
    this.currentOpts = opts;
    const launched = await this.launch(opts);
    this.adopt(launched);
    launched.pages.forEach((page) => this.onPageCreated?.(page));
    await this.applyViewport(launched.page);
  }

  async stop(): Promise<void> {
    if (this.extension) {
      await this.extension.disconnect();
    } else {
      if (this.context && !this.browser) await this.context.close();
      if (this.browser) await this.browser.close();
    }
    this.resetState();
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

  getMode(): LaunchMode | null {
    return this.mode;
  }

  getStatus(): BrowserStatus {
    return {
      hasBrowser: this.context !== null,
      hasContext: this.context !== null,
      hasPage: this.page !== null,
      currentUrl: this.page?.url(),
      mode: this.mode ?? undefined,
      profile: this.extension?.profileLabel ?? this.currentOpts.profile,
      relayPort: this.relay?.port,
    };
  }

  requirePage(): Page {
    if (!this.page) {
      throw new Error('Browser not started');
    }
    return this.page;
  }

  requireContext(): BrowserContext {
    if (!this.context) {
      throw new Error('Browser not started');
    }
    return this.context;
  }

  private defaultWaitUntil(): WaitUntil {
    return this.mode === LaunchMode.Ephemeral || this.mode === LaunchMode.Persistent
      ? WaitUntil.NetworkIdle
      : WaitUntil.Load;
  }

  async navigate(url: string, waitUntil?: WaitUntil): Promise<void> {
    const page = this.requirePage();
    await page.goto(url, { waitUntil: toGotoWaitUntil(waitUntil ?? this.defaultWaitUntil()) });
  }

  async back(waitUntil?: WaitUntil): Promise<void> {
    const page = this.requirePage();
    await page.goBack({ waitUntil: toGotoWaitUntil(waitUntil ?? WaitUntil.Load) });
  }

  async forward(waitUntil?: WaitUntil): Promise<void> {
    const page = this.requirePage();
    await page.goForward({ waitUntil: toGotoWaitUntil(waitUntil ?? WaitUntil.Load) });
  }

  async reload(waitUntil?: WaitUntil): Promise<void> {
    const page = this.requirePage();
    await page.reload({ waitUntil: toGotoWaitUntil(waitUntil ?? WaitUntil.Load) });
  }

  async screenshot(path: string, fullPage: boolean): Promise<void> {
    await this.requirePage().screenshot({ path, fullPage });
  }

  async click(selector: string): Promise<void> {
    await this.requirePage().click(selector);
  }

  async type(selector: string, text: string): Promise<void> {
    await this.requirePage().fill(selector, text);
  }

  async waitForSelector(selector: string, timeout: number): Promise<void> {
    await this.requirePage().waitForSelector(selector, { timeout });
  }

  async getContent(): Promise<string> {
    return this.requirePage().content();
  }

  async getTitle(): Promise<string> {
    return this.requirePage().title();
  }

  getUrl(): string {
    return this.requirePage().url();
  }

  async pressKey(key: string): Promise<void> {
    await this.requirePage().keyboard.press(key);
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.requirePage().selectOption(selector, value);
  }

  async hover(selector: string): Promise<void> {
    await this.requirePage().hover(selector);
  }

  async snapshot(selector?: string, opts: SnapshotOptions = {}): Promise<string> {
    const page = this.requirePage();
    const locator = selector ? page.locator(selector) : page.locator('body');
    const ariaOpts = removeUndefined({
      mode: opts.mode,
      boxes: opts.boxes,
      depth: opts.depth,
    }) as AriaSnapshotOptions;
    return locator.ariaSnapshot(ariaOpts);
  }

  cdpSend(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.cdp.send(this.requireContext(), this.requirePage(), method, params);
  }

  async traceStart(opts: TraceStartOptions = {}): Promise<void> {
    await this.requireContext().tracing.start({
      screenshots: opts.screenshots ?? true,
      snapshots: opts.snapshots ?? true,
    });
  }

  async traceStop(filePath: string): Promise<string> {
    await this.requireContext().tracing.stop({ path: filePath });
    return filePath;
  }

  async clockInstall(time?: ClockTime): Promise<void> {
    await this.requirePage().clock.install(time === undefined ? {} : { time });
  }

  async clockSetFixedTime(time: ClockTime): Promise<void> {
    await this.requirePage().clock.setFixedTime(time);
  }

  async clockFastForward(ticks: ClockTime): Promise<void> {
    await this.requirePage().clock.fastForward(ticks);
  }

  async scroll(x: number, y: number): Promise<void> {
    await this.requirePage().evaluate(`window.scrollBy(${x}, ${y})`);
  }

  async evaluate<T>(code: string): Promise<T> {
    return this.requirePage().evaluate(code) as Promise<T>;
  }

  async executePlaywrightCode<T>(code: string): Promise<T> {
    const asyncFn = new Function(
      'page',
      'context',
      'browser',
      `return (async () => { ${code} })();`,
    );
    return asyncFn(this.requirePage(), this.context, this.browser) as Promise<T>;
  }

  async listPages(): Promise<PageInfo[]> {
    if (this.extension) {
      const tabs = await this.extension.listTabs();
      return tabs.map((t, index) => ({
        index,
        url: t.url,
        title: t.title,
        tabId: t.id,
        windowId: t.windowId,
        active: t.active,
        attached: t.attached,
      }));
    }
    if (!this.context) return [];
    const pages = this.context.pages();
    return Promise.all(pages.map(async (p, index) => ({ index, url: p.url(), title: await p.title() })));
  }

  async switchToPage(index: number): Promise<void> {
    if (this.extension) {
      const tabs = await this.extension.listTabs();
      const tab = tabs[index];
      if (!tab) throw new Error(`Invalid page index: ${index}. Available: 0-${tabs.length - 1}`);
      return this.activate(await this.extension.switchTo(tab.id));
    }
    const pages = this.requireContext().pages();
    if (index < 0 || index >= pages.length) {
      throw new Error(`Invalid page index: ${index}. Available: 0-${pages.length - 1}`);
    }
    await this.activate(pages[index]);
  }

  async switchToLatestPage(): Promise<void> {
    if (this.extension) return this.activate(await this.extension.latest());
    const pages = this.requireContext().pages();
    if (pages.length > 0) await this.activate(pages[pages.length - 1]);
  }

  private async activate(page: Page): Promise<void> {
    this.page = page;
    this.onPageCreated?.(page);
    await this.applyViewport(page);
  }

  private async applyViewport(page: Page): Promise<void> {
    if (this.mode !== LaunchMode.Extension) return;
    if (effectiveViewport(this.currentOpts) !== ViewportMode.Emulated) return;
    await page.setViewportSize(EMULATED_VIEWPORT);
  }

  private async launch(opts: StartOptions): Promise<Launched> {
    if (opts.extension) return this.launchExtension(opts);
    const deviceConfig = this.resolveDeviceConfig(opts.device, effectiveViewport(opts));
    if (opts.attach) return connectAttached(opts.attach);
    const channel = opts.browser ? channelFor(opts.browser) : undefined;
    if (isPersistentMode(opts)) return launchPersistent(opts, channel, deviceConfig);
    return launchEphemeral(channel, deviceConfig);
  }

  private async launchExtension(opts: StartOptions): Promise<Launched> {
    if (!this.relay) throw new Error('Extension mode requires the server to run with --extension');
    if (opts.device) throw new Error('Device emulation is not available in extension mode');
    const driver = new ExtensionDriver(this.relay);
    const launched = await driver.connect(
      { profile: opts.profile, window: opts.window, tab: opts.tab },
      EXTENSION_CONNECT_TIMEOUT_MS,
    );
    this.extension = driver;
    launched.browser?.once('disconnected', () => {
      if (this.browser === launched.browser) this.resetState();
    });
    return launched;
  }

  private adopt(launched: Launched): void {
    this.browser = launched.browser;
    this.context = launched.context;
    this.page = launched.page;
    this.mode = launched.mode;
    launched.context.on('page', (page) => this.onPageCreated?.(page));
  }

  private resetState(): void {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.currentDevice = null;
    this.mode = null;
    this.extension = null;
  }

  private resolveDeviceConfig(device?: string, viewport?: ViewportMode): DeviceConfig {
    if (device && viewport === ViewportMode.Window) {
      throw new Error('device emulation and viewport=window are mutually exclusive');
    }
    if (viewport === ViewportMode.Window) {
      this.currentDevice = null;
      return { viewport: null };
    }
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
}
