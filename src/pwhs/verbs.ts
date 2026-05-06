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
} from './http';

export enum VerbName {
  Status = 'status',
  Start = 'start',
  Stop = 'stop',
  Restart = 'restart',
  Nav = 'nav',
  Url = 'url',
  Title = 'title',
  Html = 'html',
  Snap = 'snap',
  Click = 'click',
  Type = 'type',
  Hover = 'hover',
  Select = 'select',
  Scroll = 'scroll',
  Key = 'key',
  Wait = 'wait',
  Shot = 'shot',
  Shots = 'shots',
  Eval = 'eval',
  Play = 'play',
  Poll = 'poll',
  Check = 'check',
  Pages = 'pages',
  Switch = 'switch',
  Latest = 'latest',
}

const VERB_SET = new Set<string>(Object.values(VerbName));
export const isVerbName = (s: string): s is VerbName => VERB_SET.has(s);

interface VerbRunner {
  run: (port: number, args: string[]) => Promise<unknown>;
  requires?: number;
  expects?: string;
}

interface VerbSpec<S extends z.ZodType> {
  method: HttpMethod;
  path: (args: string[]) => string;
  body?: (args: string[]) => unknown;
  schema: S;
  output?: (response: z.infer<S>) => unknown;
  requires?: number;
  expects?: string;
}

const defineVerb = <S extends z.ZodType>(spec: VerbSpec<S>): VerbRunner => ({
  run: async (port, args) => {
    const apiPath = spec.path(args);
    const body = spec.body ? spec.body(args) : undefined;
    const response = await request(port, spec.method, apiPath, body, spec.schema);
    return spec.output ? spec.output(response) : response;
  },
  requires: spec.requires,
  expects: spec.expects,
});

const VERBS: Record<VerbName, VerbRunner> = {
  [VerbName.Status]: defineVerb({ method: HttpMethod.Get, path: () => '/status', schema: PassthroughResponse }),

  [VerbName.Start]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/browser/start',
    body: ([d]) => (d ? { device: d } : {}),
    schema: PassthroughResponse,
  }),
  [VerbName.Stop]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/browser/stop',
    body: () => ({}),
    schema: PassthroughResponse,
  }),
  [VerbName.Restart]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/browser/restart',
    body: ([d]) => (d ? { device: d } : {}),
    schema: PassthroughResponse,
  }),

  [VerbName.Nav]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/navigate',
    body: ([url]) => ({ url }),
    schema: NavigateResponse,
    requires: 1,
    expects: '<url>',
  }),
  [VerbName.Url]: defineVerb({
    method: HttpMethod.Get,
    path: () => '/url',
    schema: UrlResponse,
    output: (r) => r.url,
  }),
  [VerbName.Title]: defineVerb({
    method: HttpMethod.Get,
    path: () => '/title',
    schema: TitleResponse,
    output: (r) => r.title,
  }),
  [VerbName.Html]: defineVerb({
    method: HttpMethod.Get,
    path: () => '/content',
    schema: ContentResponse,
    output: (r) => r.content,
  }),
  [VerbName.Snap]: defineVerb({
    method: HttpMethod.Get,
    path: ([sel]) => (sel ? `/snapshot?selector=${encodeURIComponent(sel)}` : '/snapshot'),
    schema: SnapshotResponse,
    output: (r) => r.snapshot,
  }),

  [VerbName.Click]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/click',
    body: ([s]) => ({ selector: s }),
    schema: PassthroughResponse,
    requires: 1,
    expects: '<selector>',
  }),
  [VerbName.Type]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/type',
    body: ([s, t]) => ({ selector: s, text: t }),
    schema: PassthroughResponse,
    requires: 2,
    expects: '<selector> <text>',
  }),
  [VerbName.Hover]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/hover',
    body: ([s]) => ({ selector: s }),
    schema: PassthroughResponse,
    requires: 1,
    expects: '<selector>',
  }),
  [VerbName.Select]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/select',
    body: ([s, v]) => ({ selector: s, value: v }),
    schema: PassthroughResponse,
    requires: 2,
    expects: '<selector> <value>',
  }),
  [VerbName.Scroll]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/scroll',
    body: ([x, y]) => ({ x: Number(x ?? 0), y: Number(y ?? 0) }),
    schema: PassthroughResponse,
  }),
  [VerbName.Key]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/keyboard',
    body: ([k]) => ({ key: k }),
    schema: PassthroughResponse,
    requires: 1,
    expects: '<key>',
  }),
  [VerbName.Wait]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/wait',
    body: ([s, t]) => ({ selector: s, ...(t ? { timeout: Number(t) } : {}) }),
    schema: PassthroughResponse,
    requires: 1,
    expects: '<selector> [timeout-ms]',
  }),

  [VerbName.Shot]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/screenshot',
    body: ([n]) => (n ? { name: n } : {}),
    schema: ScreenshotResponse,
    output: (r) => r.path,
  }),
  [VerbName.Shots]: defineVerb({
    method: HttpMethod.Get,
    path: () => '/screenshots',
    schema: ScreenshotsResponse,
    output: (r) => r.screenshots,
  }),

  [VerbName.Eval]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/execute/inline',
    body: ([c]) => ({ code: c }),
    schema: ResultResponse,
    output: (r) => r.result,
    requires: 1,
    expects: '<js>',
  }),
  [VerbName.Play]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/script/execute-playwright',
    body: ([c]) => ({ code: c }),
    schema: ResultResponse,
    output: (r) => r.result,
    requires: 1,
    expects: '<js>',
  }),

  [VerbName.Poll]: defineVerb({
    method: HttpMethod.Get,
    path: ([s]) => `/activity/poll?since=${Number(s ?? 0)}`,
    schema: PassthroughResponse,
  }),
  [VerbName.Check]: defineVerb({
    method: HttpMethod.Get,
    path: ([s]) => `/activity/check?since=${Number(s ?? 0)}`,
    schema: PassthroughResponse,
  }),

  [VerbName.Pages]: defineVerb({
    method: HttpMethod.Get,
    path: () => '/pages',
    schema: PagesResponse,
    output: (r) => r.pages,
  }),
  [VerbName.Switch]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/pages/switch',
    body: ([i]) => ({ index: Number(i) }),
    schema: PassthroughResponse,
    requires: 1,
    expects: '<index>',
  }),
  [VerbName.Latest]: defineVerb({
    method: HttpMethod.Post,
    path: () => '/pages/switch-latest',
    body: () => ({}),
    schema: PassthroughResponse,
  }),
};

export const runVerb = async (verb: VerbName, port: number, args: string[]): Promise<unknown> => {
  const def = VERBS[verb];
  if (def.requires !== undefined && args.length < def.requires) {
    throw new Error(`pwhs ${verb} ${def.expects ?? ''}`.trim());
  }
  return def.run(port, args);
};
