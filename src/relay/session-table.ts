import type { TargetInfo } from '../extension/protocol';

export const ROOT_SESSION = '';

export enum SessionKind {
  Root = 'root',
  Browser = 'browser',
  Tab = 'tab',
  Child = 'child',
  Unknown = 'unknown',
}

export type Classified =
  | { kind: SessionKind.Root }
  | { kind: SessionKind.Browser; sessionId: string }
  | { kind: SessionKind.Tab; sessionId: string; tabId: number }
  | { kind: SessionKind.Child; sessionId: string; tabId: number }
  | { kind: SessionKind.Unknown };

export interface TabRecord {
  tabId: number;
  targetInfo: TargetInfo;
  primary: string;
  aliases: Map<string, string>;
  announced: boolean;
}

export class SessionTable {
  private counter = 0;
  private readonly tabsById = new Map<number, TabRecord>();
  private readonly tabBySessionId = new Map<string, number>();
  private tabByChildSession = new Map<string, number>();
  private readonly browserSessions = new Set<string>();

  private newSessionId(): string {
    this.counter += 1;
    return `pwhs-session-${this.counter}`;
  }

  addTab(tabId: number, targetInfo: TargetInfo): TabRecord {
    const primary = this.newSessionId();
    const record: TabRecord = { tabId, targetInfo, primary, aliases: new Map(), announced: false };
    this.tabsById.set(tabId, record);
    this.tabBySessionId.set(primary, tabId);
    return record;
  }

  tab(tabId: number): TabRecord | undefined {
    return this.tabsById.get(tabId);
  }

  tabByTarget(targetId: string): TabRecord | undefined {
    return this.tabs().find((t) => t.targetInfo.targetId === targetId);
  }

  tabs(): TabRecord[] {
    return [...this.tabsById.values()];
  }

  unannounced(): TabRecord[] {
    return this.tabs().filter((t) => !t.announced);
  }

  addAlias(tabId: number, parentSessionId: string): string {
    const record = this.require(tabId);
    const alias = this.newSessionId();
    record.aliases.set(alias, parentSessionId);
    this.tabBySessionId.set(alias, tabId);
    return alias;
  }

  removeAlias(sessionId: string): { tabId: number; parent: string } | undefined {
    const tabId = this.tabBySessionId.get(sessionId);
    if (tabId === undefined) return undefined;
    const record = this.require(tabId);
    const parent = record.aliases.get(sessionId);
    if (parent === undefined) return undefined;
    record.aliases.delete(sessionId);
    this.tabBySessionId.delete(sessionId);
    return { tabId, parent };
  }

  addBrowserSession(): string {
    const id = this.newSessionId();
    this.browserSessions.add(id);
    return id;
  }

  addChild(tabId: number, childSessionId: string): void {
    this.tabByChildSession.set(childSessionId, tabId);
  }

  removeChild(childSessionId: string): void {
    this.tabByChildSession.delete(childSessionId);
  }

  sessionsOf(tabId: number): string[] {
    const record = this.tabsById.get(tabId);
    return record ? [record.primary, ...record.aliases.keys()] : [];
  }

  removeTab(tabId: number): TabRecord | undefined {
    const record = this.tabsById.get(tabId);
    if (!record) return undefined;
    this.sessionsOf(tabId).forEach((id) => this.tabBySessionId.delete(id));
    this.tabsById.delete(tabId);
    this.tabByChildSession = new Map([...this.tabByChildSession].filter(([, owner]) => owner !== tabId));
    return record;
  }

  classify(sessionId: string | undefined): Classified {
    if (!sessionId) return { kind: SessionKind.Root };
    if (this.browserSessions.has(sessionId)) return { kind: SessionKind.Browser, sessionId };
    const tabId = this.tabBySessionId.get(sessionId);
    if (tabId !== undefined) return { kind: SessionKind.Tab, sessionId, tabId };
    const childOwner = this.tabByChildSession.get(sessionId);
    if (childOwner !== undefined) return { kind: SessionKind.Child, sessionId, tabId: childOwner };
    return { kind: SessionKind.Unknown };
  }

  private require(tabId: number): TabRecord {
    const record = this.tabsById.get(tabId);
    if (!record) throw new Error(`Tab ${tabId} is not attached`);
    return record;
  }
}
