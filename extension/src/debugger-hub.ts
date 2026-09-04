import { ExtensionEvent, PayloadOf, TargetInfo } from '../../src/extension/protocol';

const PROTOCOL_VERSION = '1.3';
const TARGET_INFO_METHOD = 'Target.getTargetInfo';

export interface Holder {
  sendEvent<E extends ExtensionEvent>(event: E, payload: PayloadOf<E>): void;
}

const TargetInfoResult = TargetInfo.pick({ targetId: true, type: true, title: true, url: true, attached: true, browserContextId: true });

export class DebuggerHub {
  private readonly holders = new Map<number, Set<Holder>>();

  constructor() {
    chrome.debugger.onEvent.addListener((source, method, params) => this.onEvent(source, method, params));
    chrome.debugger.onDetach.addListener((source, reason) => this.onDetach(source, reason));
    chrome.tabs.onCreated.addListener((tab) => { this.onTabCreated(tab).catch(() => undefined); });
    chrome.tabs.onRemoved.addListener((tabId) => this.onTabRemoved(tabId));
  }

  async attach(holder: Holder, tabId: number): Promise<{ targetInfo: TargetInfo }> {
    const existing = this.holders.get(tabId);
    if (existing) {
      existing.add(holder);
    } else {
      await chrome.debugger.attach({ tabId }, PROTOCOL_VERSION);
      this.holders.set(tabId, new Set([holder]));
    }
    const raw = (await chrome.debugger.sendCommand({ tabId }, TARGET_INFO_METHOD)) as { targetInfo: unknown };
    return { targetInfo: { ...TargetInfoResult.parse(raw.targetInfo), attached: true } };
  }

  async detach(holder: Holder, tabId: number): Promise<void> {
    const set = this.holders.get(tabId);
    if (!set) return;
    set.delete(holder);
    if (set.size > 0) return;
    this.holders.delete(tabId);
    await chrome.debugger.detach({ tabId }).catch(() => undefined);
  }

  tabsHeldBy(holder: Holder): number[] {
    return [...this.holders].filter(([, set]) => set.has(holder)).map(([tabId]) => tabId);
  }

  async releaseAll(holder: Holder): Promise<void> {
    await Promise.all(this.tabsHeldBy(holder).map((tabId) => this.detach(holder, tabId)));
  }

  send(tabId: number, sessionId: string | undefined, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const target: chrome.debugger.DebuggerSession = sessionId ? { tabId, sessionId } : { tabId };
    return chrome.debugger.sendCommand(target, method, params);
  }

  private holdersOf(tabId: number | undefined): Holder[] {
    return tabId === undefined ? [] : [...(this.holders.get(tabId) ?? [])];
  }

  private onEvent(source: chrome.debugger.DebuggerSession, method: string, params?: object): void {
    this.holdersOf(source.tabId).forEach((holder) =>
      holder.sendEvent(ExtensionEvent.CdpEvent, {
        tabId: source.tabId as number,
        sessionId: source.sessionId,
        method,
        params: params ?? {},
      }),
    );
  }

  private onDetach(source: chrome.debugger.Debuggee, reason: string): void {
    const tabId = source.tabId;
    if (tabId === undefined) return;
    const holders = this.holdersOf(tabId);
    this.holders.delete(tabId);
    holders.forEach((holder) => holder.sendEvent(ExtensionEvent.TabDetached, { tabId, reason }));
  }

  private async onTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    const openerTabId = tab.openerTabId;
    if (openerTabId === undefined || tab.id === undefined) return;
    const tabId = tab.id;
    await Promise.all(this.holdersOf(openerTabId).map(async (holder) => {
      const { targetInfo } = await this.attach(holder, tabId);
      holder.sendEvent(ExtensionEvent.TabOpened, { tabId, openerTabId, targetInfo });
    }));
  }

  private onTabRemoved(tabId: number): void {
    const holders = this.holdersOf(tabId);
    this.holders.delete(tabId);
    holders.forEach((holder) => holder.sendEvent(ExtensionEvent.TabClosed, { tabId }));
  }
}
