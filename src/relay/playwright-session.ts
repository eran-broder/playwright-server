import { EventEmitter } from 'events';
import type { WebSocket, RawData } from 'ws';
import { ExtensionMethod, TargetInfo } from '../extension/protocol';
import { ExtensionConnection } from './extension-connection';
import { SessionKind, SessionTable, TabRecord } from './session-table';
import { CdpCommand, CdpErrorCode, CdpOutbound, cdpError, cdpEvent, cdpResult } from './cdp-messages';
import { handlesLocally, runLocalMethod } from './browser-methods';
import { rewriteTabCommand } from './tab-methods';
import type { DataUrlStore } from './data-urls';
import { announceDetached, bindExtensionEvents } from './extension-events';
import { DEFAULT_BROWSER_CONTEXT, SessionContext } from './session-context';
import { parseJson, sendJson } from './ws-utils';

export enum SessionEvent {
  TabAttached = 'tabAttached',
  TabDetached = 'tabDetached',
  Closed = 'closed',
}

export interface TabAttachedPayload {
  tabId: number;
  targetId: string;
}

const ATTACHED_EVENT = 'Target.attachedToTarget';

export class PlaywrightSession extends EventEmitter implements SessionContext {
  readonly table = new SessionTable();
  private ws: WebSocket | null = null;
  private autoAttach = false;
  private disposed = false;
  private readonly unbindEvents: () => void;

  constructor(
    readonly ext: ExtensionConnection,
    readonly dataUrls: DataUrlStore,
    readonly anchorTabId: number,
  ) {
    super();
    this.unbindEvents = bindExtensionEvents(this);
    ext.onClose(() => this.close());
  }

  async prepare(): Promise<void> {
    await this.attachTab(this.anchorTabId);
  }

  bind(ws: WebSocket): void {
    this.ws = ws;
    ws.on('message', (data) => this.onMessage(data));
    ws.on('close', () => this.close());
  }

  send(message: CdpOutbound): void {
    if (this.ws) sendJson(this.ws, message);
  }

  async attachTab(tabId: number, extra: Partial<TargetInfo> = {}): Promise<TabRecord> {
    const existing = this.table.tab(tabId);
    if (existing) return existing;
    const { targetInfo } = await this.ext.call(ExtensionMethod.Attach, { tabId });
    const record = this.table.addTab(tabId, {
      ...targetInfo,
      ...extra,
      attached: true,
      browserContextId: targetInfo.browserContextId ?? DEFAULT_BROWSER_CONTEXT,
    });
    this.announcePending();
    this.emit(SessionEvent.TabAttached, { tabId, targetId: record.targetInfo.targetId } satisfies TabAttachedPayload);
    return record;
  }

  async detachTab(tabId: number): Promise<void> {
    const record = this.table.removeTab(tabId);
    if (!record) return;
    announceDetached(this, record);
    await this.ext.call(ExtensionMethod.Detach, { tabId }).catch(() => undefined);
    this.emit(SessionEvent.TabDetached, tabId);
  }

  enableAutoAttach(): void {
    this.autoAttach = true;
    this.announcePending();
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unbindEvents();
    const tabIds = this.table.tabs().map((t) => t.tabId);
    tabIds.forEach((tabId) => this.table.removeTab(tabId));
    Promise.all(tabIds.map((tabId) => this.ext.call(ExtensionMethod.Detach, { tabId }).catch(() => undefined)))
      .finally(() => this.emit(SessionEvent.Closed));
    this.ws?.close();
    this.ws = null;
  }

  private announcePending(): void {
    if (!this.autoAttach) return;
    this.table.unannounced().forEach((record) => {
      record.announced = true;
      this.send(cdpEvent(ATTACHED_EVENT, {
        sessionId: record.primary,
        targetInfo: record.targetInfo,
        waitingForDebugger: false,
      }));
    });
  }

  private onMessage(data: RawData): void {
    const parsed = CdpCommand.safeParse(parseJson(data));
    if (!parsed.success) return;
    this.handle(parsed.data).catch(() => undefined);
  }

  private async handle(cmd: CdpCommand): Promise<void> {
    try {
      const result = await this.route(cmd);
      this.send(cdpResult(cmd, result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.send(cdpError(cmd, CdpErrorCode.ServerError, message));
    }
  }

  private route(cmd: CdpCommand): Promise<unknown> {
    const target = this.table.classify(cmd.sessionId);
    if (handlesLocally(cmd.method, target.kind)) return runLocalMethod(this, cmd);
    if (target.kind === SessionKind.Tab) {
      return this.forward(target.tabId, rewriteTabCommand(this, target.tabId, cmd));
    }
    if (target.kind === SessionKind.Child) return this.forward(target.tabId, cmd, target.sessionId);
    if (target.kind === SessionKind.Unknown) throw new Error(`Unknown session: ${cmd.sessionId}`);
    return this.forward(this.anchorTabId, cmd);
  }

  private forward(tabId: number, cmd: CdpCommand, sessionId?: string): Promise<unknown> {
    return this.ext.call(ExtensionMethod.Cdp, { tabId, sessionId, method: cmd.method, params: cmd.params });
  }
}
