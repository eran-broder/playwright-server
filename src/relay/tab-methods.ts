import { z } from 'zod';
import type { CdpCommand } from './cdp-messages';
import type { SessionContext } from './session-context';
import { isDataUrl } from './data-urls';

enum TabMethod {
  PageNavigate = 'Page.navigate',
}

const NavigateParams = z.object({ url: z.string(), frameId: z.string().optional() });

type Rewrite = (ctx: SessionContext, tabId: number, cmd: CdpCommand) => CdpCommand;

const isTopFrame = (ctx: SessionContext, tabId: number, frameId?: string): boolean =>
  frameId === undefined || ctx.table.tab(tabId)?.targetInfo.targetId === frameId;

const serveDataNavigation: Rewrite = (ctx, tabId, cmd) => {
  const { url, frameId } = NavigateParams.parse(cmd.params ?? {});
  if (!isDataUrl(url) || !isTopFrame(ctx, tabId, frameId)) return cmd;
  return { ...cmd, params: { ...cmd.params, url: ctx.dataUrls.publish(url) } };
};

const REWRITES: Record<TabMethod, Rewrite> = {
  [TabMethod.PageNavigate]: serveDataNavigation,
};

const isTabMethod = (method: string): method is TabMethod => method in REWRITES;

export const rewriteTabCommand = (ctx: SessionContext, tabId: number, cmd: CdpCommand): CdpCommand =>
  isTabMethod(cmd.method) ? REWRITES[cmd.method](ctx, tabId, cmd) : cmd;
