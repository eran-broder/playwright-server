import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ExtensionMethod, TabInfo } from './extension/protocol';
import { Relay } from './relay/relay';
import { ExtensionConnection } from './relay/extension-connection';
import { PlaywrightSession, SessionEvent, TabAttachedPayload } from './relay/playwright-session';
import { flattenTabs, pickInitialTab, TabSelection } from './relay/tab-selection';
import { Launched, LaunchMode } from './launchers';

const BLANK_URL = 'about:blank';

export interface ExtensionSelection extends TabSelection {
  profile?: string;
}

export interface ExtensionTab extends TabInfo {
  attached: boolean;
}

export class ExtensionDriver {
  private instance: ExtensionConnection | null = null;
  private session: PlaywrightSession | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private readonly pagesByTab = new Map<number, Page>();
  private readonly pendingTabs: number[] = [];
  private readonly waiters = new Map<number, Array<(page: Page) => void>>();

  constructor(private readonly relay: Relay) {}

  get profileLabel(): string | null {
    return this.instance?.label ?? null;
  }

  async connect(selection: ExtensionSelection, timeoutMs: number): Promise<Launched> {
    const instance = await this.relay.instances.waitFor(selection.profile, timeoutMs);
    const tabId = await this.resolveInitialTab(instance, selection);
    const { url, session } = await this.relay.openSession(instance, tabId);
    session.on(SessionEvent.TabAttached, (p: TabAttachedPayload) => this.pendingTabs.push(p.tabId));
    session.on(SessionEvent.TabDetached, (id: number) => this.pagesByTab.delete(id));

    const browser = await chromium.connectOverCDP(url);
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    if (!context || !page) throw new Error('Extension session produced no page');

    this.instance = instance;
    this.session = session;
    this.browser = browser;
    this.context = context;
    this.pendingTabs.length = 0;
    this.track(tabId, page);
    context.on('page', (p) => this.onPage(p));
    return { browser, context, page, mode: LaunchMode.Extension, pages: [page] };
  }

  async listTabs(): Promise<ExtensionTab[]> {
    const catalog = await this.requireInstance().call(ExtensionMethod.Catalog, {});
    return flattenTabs(catalog).map((t) => ({ ...t, attached: this.pagesByTab.has(t.id) }));
  }

  async switchTo(tabId: number): Promise<Page> {
    const existing = this.pagesByTab.get(tabId);
    if (existing) return existing;
    const waiting = this.waitForPage(tabId);
    await this.requireSession().attachTab(tabId);
    return waiting;
  }

  async latest(): Promise<Page> {
    const tabs = await this.listTabs();
    const newest = tabs.reduce((best, t) => (t.id > best.id ? t : best), tabs[0]);
    if (!newest) throw new Error('No tabs in this profile');
    return this.switchTo(newest.id);
  }

  async disconnect(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.session?.close();
    this.browser = null;
    this.context = null;
    this.session = null;
    this.instance = null;
    this.pagesByTab.clear();
  }

  private async resolveInitialTab(instance: ExtensionConnection, selection: TabSelection): Promise<number> {
    const catalog = await instance.call(ExtensionMethod.Catalog, {});
    const chosen = pickInitialTab(catalog, selection);
    if (chosen) return chosen.id;
    const { tab } = await instance.call(ExtensionMethod.CreateTab, { url: BLANK_URL });
    return tab.id;
  }

  private onPage(page: Page): void {
    const tabId = this.pendingTabs.shift();
    if (tabId === undefined) return;
    this.track(tabId, page);
  }

  private track(tabId: number, page: Page): void {
    this.pagesByTab.set(tabId, page);
    page.once('close', () => {
      if (this.pagesByTab.get(tabId) === page) this.pagesByTab.delete(tabId);
    });
    this.waiters.get(tabId)?.forEach((resolve) => resolve(page));
    this.waiters.delete(tabId);
  }

  private waitForPage(tabId: number): Promise<Page> {
    return new Promise((resolve) => {
      const list = this.waiters.get(tabId) ?? [];
      list.push(resolve);
      this.waiters.set(tabId, list);
    });
  }

  private requireInstance(): ExtensionConnection {
    if (!this.instance) throw new Error('Extension not connected');
    return this.instance;
  }

  private requireSession(): PlaywrightSession {
    if (!this.session) throw new Error('Extension not connected');
    return this.session;
  }
}
