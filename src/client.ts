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
  TraceStopResponse,
  PagesResponse,
} from './pwhs/http';
import { spawnServer } from './pwhs/spawn';
import { BrowserKind, ProfileMode } from './profile-finder';
import { SnapshotMode, WaitUntil } from './types';
import type { SnapshotOptions } from './types';
import type { ClockTime, TraceStartOptions } from './browser-manager';

export { BrowserKind, ProfileMode, SnapshotMode, WaitUntil };
export type { ClockTime, SnapshotOptions, TraceStartOptions };

export interface StartServerOptions {
  browser?: BrowserKind;
  profile?: string;
  profileMode?: ProfileMode;
  userDataDir?: string;
  attach?: string;
}

const buildServerFlags = (opts: StartServerOptions): string[] => {
  const flags: string[] = [];
  if (opts.browser) flags.push('--browser', opts.browser);
  if (opts.profile) flags.push('--profile', opts.profile);
  if (opts.profileMode) flags.push('--profile-mode', opts.profileMode);
  if (opts.userDataDir) flags.push('--user-data-dir', opts.userDataDir);
  if (opts.attach) flags.push('--attach', opts.attach);
  return flags;
};

const snapshotQuery = (selector?: string, opts: SnapshotOptions = {}): string => {
  const q = new URLSearchParams();
  if (selector) q.set('selector', selector);
  if (opts.mode) q.set('mode', opts.mode);
  if (opts.boxes !== undefined) q.set('boxes', String(opts.boxes));
  if (opts.depth !== undefined) q.set('depth', String(opts.depth));
  const qs = q.toString();
  return qs ? `/snapshot?${qs}` : '/snapshot';
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

  nav(url: string, waitUntil?: WaitUntil) {
    return this.post('/navigate', { url, ...(waitUntil ? { waitUntil } : {}) }, NavigateResponse);
  }
  back(waitUntil?: WaitUntil) {
    return this.post('/back', waitUntil ? { waitUntil } : {}, NavigateResponse);
  }
  forward(waitUntil?: WaitUntil) {
    return this.post('/forward', waitUntil ? { waitUntil } : {}, NavigateResponse);
  }
  reload(waitUntil?: WaitUntil) {
    return this.post('/reload', waitUntil ? { waitUntil } : {}, NavigateResponse);
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
  async snap(selector?: string, opts?: SnapshotOptions): Promise<string> {
    return (await this.get(snapshotQuery(selector, opts), SnapshotResponse)).snapshot;
  }
  snapAi(selector?: string): Promise<string> {
    return this.snap(selector, { mode: SnapshotMode.Ai });
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

  async cdp<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    return (await this.post('/cdp', { method, params }, ResultResponse)).result as T;
  }
  traceStart(opts?: TraceStartOptions) {
    return this.post('/trace/start', opts ?? {}, PassthroughResponse);
  }
  async traceStop(): Promise<string> {
    return (await this.post('/trace/stop', {}, TraceStopResponse)).path;
  }
  clockInstall(time?: ClockTime) {
    return this.post('/clock/install', time === undefined ? {} : { time }, PassthroughResponse);
  }
  clockSet(time: ClockTime) {
    return this.post('/clock/set', { time }, PassthroughResponse);
  }
  clockFastForward(ticks: ClockTime) {
    return this.post('/clock/fast-forward', { ticks }, PassthroughResponse);
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
