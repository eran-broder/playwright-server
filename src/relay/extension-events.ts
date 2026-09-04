import { z } from 'zod';
import { DownloadState, ExtensionEvent, PayloadOf } from '../extension/protocol';
import { cdpEvent } from './cdp-messages';
import { SessionContext } from './session-context';
import { SessionTable, TabRecord } from './session-table';

enum TargetEvent {
  AttachedToTarget = 'Target.attachedToTarget',
  DetachedFromTarget = 'Target.detachedFromTarget',
}

enum DownloadEvent {
  WillBegin = 'Browser.downloadWillBegin',
  Progress = 'Browser.downloadProgress',
}

enum CdpDownloadState {
  Completed = 'completed',
  Canceled = 'canceled',
}

const ChildSessionParams = z.object({ sessionId: z.string() });

const trackChildSessions = (table: SessionTable, tabId: number, method: string, params: unknown): void => {
  const parsed = ChildSessionParams.safeParse(params);
  if (!parsed.success) return;
  if (method === TargetEvent.AttachedToTarget) table.addChild(tabId, parsed.data.sessionId);
  if (method === TargetEvent.DetachedFromTarget) table.removeChild(parsed.data.sessionId);
};

const onCdpEvent = (ctx: SessionContext, payload: PayloadOf<ExtensionEvent.CdpEvent>): void => {
  if (payload.sessionId) {
    ctx.send(cdpEvent(payload.method, payload.params, payload.sessionId));
    return;
  }
  trackChildSessions(ctx.table, payload.tabId, payload.method, payload.params);
  ctx.table
    .sessionsOf(payload.tabId)
    .forEach((sessionId) => ctx.send(cdpEvent(payload.method, payload.params, sessionId)));
};

export const announceDetached = (ctx: SessionContext, record: TabRecord): void => {
  const { targetId } = record.targetInfo;
  record.aliases.forEach((parent, alias) =>
    ctx.send(cdpEvent(TargetEvent.DetachedFromTarget, { sessionId: alias, targetId }, parent || undefined)),
  );
  if (record.announced) {
    ctx.send(cdpEvent(TargetEvent.DetachedFromTarget, { sessionId: record.primary, targetId }));
  }
};

const onTabGone = (ctx: SessionContext, tabId: number): void => {
  const record = ctx.table.removeTab(tabId);
  if (record) announceDetached(ctx, record);
};

const onTabOpened = async (ctx: SessionContext, payload: PayloadOf<ExtensionEvent.TabOpened>): Promise<void> => {
  const opener = ctx.table.tab(payload.openerTabId);
  await ctx.attachTab(payload.tabId, { openerId: opener?.targetInfo.targetId });
};

const attributeDownload = (ctx: SessionContext, referrer: string): TabRecord | undefined => {
  const tabs = ctx.table.tabs();
  const byReferrer = tabs.find((t) => referrer && (t.targetInfo.url.startsWith(referrer) || referrer.startsWith(t.targetInfo.url)));
  return byReferrer ?? ctx.table.tab(ctx.anchorTabId) ?? tabs[0];
};

const onDownloadStarted = (ctx: SessionContext, payload: PayloadOf<ExtensionEvent.DownloadStarted>): void => {
  const tab = attributeDownload(ctx, payload.referrer);
  if (!tab) return;
  ctx.send(cdpEvent(DownloadEvent.WillBegin, {
    frameId: tab.targetInfo.targetId,
    guid: String(payload.id),
    url: payload.url,
    suggestedFilename: payload.filename,
  }));
};

const onDownloadFinished = (ctx: SessionContext, payload: PayloadOf<ExtensionEvent.DownloadFinished>): void => {
  ctx.send(cdpEvent(DownloadEvent.Progress, {
    guid: String(payload.id),
    totalBytes: 0,
    receivedBytes: 0,
    state: payload.state === DownloadState.Complete ? CdpDownloadState.Completed : CdpDownloadState.Canceled,
  }));
};

export const bindExtensionEvents = (ctx: SessionContext): (() => void) => {
  const unsubscribers = [
    ctx.ext.on(ExtensionEvent.CdpEvent, (p) => onCdpEvent(ctx, p)),
    ctx.ext.on(ExtensionEvent.TabDetached, (p) => onTabGone(ctx, p.tabId)),
    ctx.ext.on(ExtensionEvent.TabClosed, (p) => onTabGone(ctx, p.tabId)),
    ctx.ext.on(ExtensionEvent.TabOpened, (p) => { onTabOpened(ctx, p).catch(() => undefined); }),
    ctx.ext.on(ExtensionEvent.DownloadStarted, (p) => onDownloadStarted(ctx, p)),
    ctx.ext.on(ExtensionEvent.DownloadFinished, (p) => onDownloadFinished(ctx, p)),
  ];
  return () => unsubscribers.forEach((off) => off());
};
