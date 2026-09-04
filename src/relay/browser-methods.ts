import { z } from 'zod';
import { ExtensionMethod, WindowBounds } from '../extension/protocol';
import { CdpCommand, CdpDomain, domainOf } from './cdp-messages';
import { SessionKind } from './session-table';
import { BROWSER_TARGET_ID, SessionContext } from './session-context';

enum LocalMethod {
  BrowserGetVersion = 'Browser.getVersion',
  BrowserSetDownloadBehavior = 'Browser.setDownloadBehavior',
  BrowserGetWindowForTarget = 'Browser.getWindowForTarget',
  BrowserSetWindowBounds = 'Browser.setWindowBounds',
  BrowserClose = 'Browser.close',
  TargetSetAutoAttach = 'Target.setAutoAttach',
  TargetSetDiscoverTargets = 'Target.setDiscoverTargets',
  TargetGetTargetInfo = 'Target.getTargetInfo',
  TargetGetTargets = 'Target.getTargets',
  TargetAttachToBrowserTarget = 'Target.attachToBrowserTarget',
  TargetAttachToTarget = 'Target.attachToTarget',
  TargetDetachFromTarget = 'Target.detachFromTarget',
  TargetCreateTarget = 'Target.createTarget',
  TargetCloseTarget = 'Target.closeTarget',
  TargetActivateTarget = 'Target.activateTarget',
}

const TargetIdParams = z.object({ targetId: z.string() });
const OptionalTargetIdParams = z.object({ targetId: z.string().optional() });
const SessionIdParams = z.object({ sessionId: z.string() });
const CreateTargetParams = z.object({ url: z.string().default('about:blank') });
const SetWindowBoundsParams = z.object({ windowId: z.number(), bounds: WindowBounds });

const PROTOCOL_VERSION = '1.3';

type Handler = (ctx: SessionContext, cmd: CdpCommand) => Promise<unknown>;

const params = <S extends z.ZodType>(cmd: CdpCommand, schema: S): z.infer<S> =>
  schema.parse(cmd.params ?? {});

const requireTabByTarget = (ctx: SessionContext, targetId: string) => {
  const tab = ctx.table.tabByTarget(targetId);
  if (!tab) throw new Error(`Unknown target: ${targetId}`);
  return tab;
};

const tabIdForWindowLookup = (ctx: SessionContext, cmd: CdpCommand): number => {
  const { targetId } = params(cmd, OptionalTargetIdParams);
  if (targetId) return requireTabByTarget(ctx, targetId).tabId;
  const owner = ctx.table.classify(cmd.sessionId);
  return owner.kind === SessionKind.Tab || owner.kind === SessionKind.Child ? owner.tabId : ctx.anchorTabId;
};

const detachFromTarget: Handler = async (ctx, cmd) => {
  const { sessionId } = params(cmd, SessionIdParams);
  const target = ctx.table.classify(sessionId);
  if (target.kind === SessionKind.Child) {
    await ctx.ext.call(ExtensionMethod.Cdp, { tabId: target.tabId, method: cmd.method, params: { sessionId } });
    return {};
  }
  if (target.kind === SessionKind.Tab) {
    if (!ctx.table.removeAlias(sessionId)) await ctx.detachTab(target.tabId);
  }
  return {};
};

const HANDLERS: Record<LocalMethod, Handler> = {
  [LocalMethod.BrowserGetVersion]: async (ctx) => ({
    protocolVersion: PROTOCOL_VERSION,
    product: `${ctx.ext.instance.brand}/${ctx.ext.instance.version}`,
    revision: '',
    userAgent: ctx.ext.instance.userAgent,
    jsVersion: '',
  }),
  [LocalMethod.BrowserSetDownloadBehavior]: async () => ({}),
  [LocalMethod.BrowserGetWindowForTarget]: async (ctx, cmd) =>
    ctx.ext.call(ExtensionMethod.WindowForTab, { tabId: tabIdForWindowLookup(ctx, cmd) }),
  [LocalMethod.BrowserSetWindowBounds]: async (ctx, cmd) =>
    ctx.ext.call(ExtensionMethod.SetWindowBounds, params(cmd, SetWindowBoundsParams)),
  [LocalMethod.BrowserClose]: async (ctx) => {
    setImmediate(() => ctx.close());
    return {};
  },
  [LocalMethod.TargetSetAutoAttach]: async (ctx) => {
    ctx.enableAutoAttach();
    return {};
  },
  [LocalMethod.TargetSetDiscoverTargets]: async () => ({}),
  [LocalMethod.TargetGetTargetInfo]: async () => ({
    targetInfo: {
      targetId: BROWSER_TARGET_ID,
      type: 'browser',
      title: '',
      url: '',
      attached: true,
      canAccessOpener: false,
    },
  }),
  [LocalMethod.TargetGetTargets]: async (ctx) => ({
    targetInfos: ctx.table.tabs().map((t) => t.targetInfo),
  }),
  [LocalMethod.TargetAttachToBrowserTarget]: async (ctx) => ({
    sessionId: ctx.table.addBrowserSession(),
  }),
  [LocalMethod.TargetAttachToTarget]: async (ctx, cmd) => {
    const { targetId } = params(cmd, TargetIdParams);
    const tab = requireTabByTarget(ctx, targetId);
    return { sessionId: ctx.table.addAlias(tab.tabId, cmd.sessionId ?? '') };
  },
  [LocalMethod.TargetDetachFromTarget]: detachFromTarget,
  [LocalMethod.TargetCreateTarget]: async (ctx, cmd) => {
    const { url } = params(cmd, CreateTargetParams);
    const { tab } = await ctx.ext.call(ExtensionMethod.CreateTab, { url, openerTabId: ctx.anchorTabId });
    const record = await ctx.attachTab(tab.id);
    return { targetId: record.targetInfo.targetId };
  },
  [LocalMethod.TargetCloseTarget]: async (ctx, cmd) => {
    const { targetId } = params(cmd, TargetIdParams);
    await ctx.ext.call(ExtensionMethod.CloseTab, { tabId: requireTabByTarget(ctx, targetId).tabId });
    return { success: true };
  },
  [LocalMethod.TargetActivateTarget]: async (ctx, cmd) => {
    const { targetId } = params(cmd, TargetIdParams);
    await ctx.ext.call(ExtensionMethod.ActivateTab, { tabId: requireTabByTarget(ctx, targetId).tabId });
    return {};
  },
};

const isLocal = (method: string): method is LocalMethod => method in HANDLERS;

const isBrowserLevelSession = (kind: SessionKind): boolean =>
  kind === SessionKind.Root || kind === SessionKind.Browser;

export const handlesLocally = (method: string, kind: SessionKind): boolean => {
  const domain = domainOf(method);
  if (domain === CdpDomain.Browser) return true;
  if (domain === CdpDomain.Target) return isBrowserLevelSession(kind) || isLocal(method);
  return false;
};

export const runLocalMethod = (ctx: SessionContext, cmd: CdpCommand): Promise<unknown> => {
  if (!isLocal(cmd.method)) {
    throw new Error(`${cmd.method} is not available in extension mode`);
  }
  return HANDLERS[cmd.method](ctx, cmd);
};
