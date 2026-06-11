import type { BrowserContext, CDPSession, Page } from 'playwright';

type CdpMethod = Parameters<CDPSession['send']>[0];
type CdpParams = Record<string, unknown> | undefined;

export class CdpBridge {
  private sessions = new WeakMap<Page, CDPSession>();

  async send(
    context: BrowserContext,
    page: Page,
    method: string,
    params?: CdpParams,
  ): Promise<unknown> {
    const session = await this.sessionFor(context, page);
    return session.send(method as CdpMethod, params);
  }

  private async sessionFor(context: BrowserContext, page: Page): Promise<CDPSession> {
    const cached = this.sessions.get(page);
    if (cached) return cached;
    const session = await context.newCDPSession(page);
    this.sessions.set(page, session);
    page.once('close', () => this.sessions.delete(page));
    return session;
  }
}
