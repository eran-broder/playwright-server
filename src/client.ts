import { z } from 'zod';
import {
  HttpMethod,
  request,
  PassthroughResponse,
  NavigateResponse,
  UrlResponse,
  TitleResponse,
  ContentResponse,
  SnapshotResponse,
  ScreenshotResponse,
  ScreenshotsResponse,
  ResultResponse,
  PagesResponse,
} from './pwhs/http';
import { spawnServer } from './pwhs/spawn';
import { BrowserKind, ProfileMode } from './profile-finder';

export { BrowserKind, ProfileMode };

export interface StartServerOptions {
  browser?: BrowserKind;
  profile?: string;
  profileMode?: ProfileMode;
  userDataDir?: string;
}

const buildServerFlags = (opts: StartServerOptions): string[] => {
  const flags: string[] = [];
  if (opts.browser) flags.push('--browser', opts.browser);
  if (opts.profile) flags.push('--profile', opts.profile);
  if (opts.profileMode) flags.push('--profile-mode', opts.profileMode);
  if (opts.userDataDir) flags.push('--user-data-dir', opts.userDataDir);
  return flags;
};

export const startServer = async (opts: StartServerOptions = {}): Promise<PwhsClient> => {
  const { port, pid } = await spawnServer(buildServerFlags(opts));
  return new PwhsClient(port, pid);
};

export class PwhsClient {
  constructor(
    public readonly port: number,
    private readonly spawnedPid?: number,
  ) {}

  static connect(port: number): PwhsClient {
    return new PwhsClient(port);
  }

  async close(): Promise<void> {
    if (this.spawnedPid === undefined) return;
    try {
      process.kill(this.spawnedPid, 'SIGTERM');
    } catch {
      return;
    }
  }

  status() {
    return this.get('/status', PassthroughResponse);
  }
  start(device?: string) {
    return this.post('/browser/start', device ? { device } : {}, PassthroughResponse);
  }
  stop() {
    return this.post('/browser/stop', {}, PassthroughResponse);
  }
  restart(device?: string) {
    return this.post('/browser/restart', device ? { device } : {}, PassthroughResponse);
  }

  nav(url: string) {
    return this.post('/navigate', { url }, NavigateResponse);
  }
  async url(): Promise<string> {
    return (await this.get('/url', UrlResponse)).url;
  }
  async title(): Promise<string> {
    return (await this.get('/title', TitleResponse)).title;
  }
  async html(): Promise<string> {
    return (await this.get('/content', ContentResponse)).content;
  }
  async snap(selector?: string): Promise<string> {
    const apiPath = selector ? `/snapshot?selector=${encodeURIComponent(selector)}` : '/snapshot';
    return (await this.get(apiPath, SnapshotResponse)).snapshot;
  }

  click(selector: string) {
    return this.post('/click', { selector }, PassthroughResponse);
  }
  type(selector: string, text: string) {
    return this.post('/type', { selector, text }, PassthroughResponse);
  }
  hover(selector: string) {
    return this.post('/hover', { selector }, PassthroughResponse);
  }
  selectOption(selector: string, value: string) {
    return this.post('/select', { selector, value }, PassthroughResponse);
  }
  scroll(x = 0, y = 0) {
    return this.post('/scroll', { x, y }, PassthroughResponse);
  }
  key(key: string) {
    return this.post('/keyboard', { key }, PassthroughResponse);
  }
  wait(selector: string, timeout?: number) {
    const body = timeout !== undefined ? { selector, timeout } : { selector };
    return this.post('/wait', body, PassthroughResponse);
  }

  shot(name?: string) {
    return this.post('/screenshot', name ? { name } : {}, ScreenshotResponse);
  }
  shots() {
    return this.get('/screenshots', ScreenshotsResponse);
  }

  async eval<T = unknown>(code: string): Promise<T> {
    return (await this.post('/execute/inline', { code }, ResultResponse)).result as T;
  }
  async play<T = unknown>(code: string): Promise<T> {
    return (await this.post('/script/execute-playwright', { code }, ResultResponse)).result as T;
  }

  poll(since = 0) {
    return this.get(`/activity/poll?since=${since}`, PassthroughResponse);
  }
  check(since = 0) {
    return this.get(`/activity/check?since=${since}`, PassthroughResponse);
  }

  pages() {
    return this.get('/pages', PagesResponse);
  }
  switchPage(index: number) {
    return this.post('/pages/switch', { index }, PassthroughResponse);
  }
  switchLatest() {
    return this.post('/pages/switch-latest', {}, PassthroughResponse);
  }

  private get<S extends z.ZodType>(p: string, schema: S): Promise<z.infer<S>> {
    return request(this.port, HttpMethod.Get, p, undefined, schema);
  }

  private post<S extends z.ZodType>(p: string, body: unknown, schema: S): Promise<z.infer<S>> {
    return request(this.port, HttpMethod.Post, p, body, schema);
  }
}
