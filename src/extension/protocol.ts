import { z } from 'zod';

export const RELAY_PORT_BASE = 9333;
export const RELAY_PORT_COUNT = 10;
export const RELAY_HOST = '127.0.0.1';
export const EXTENSION_PATH = '/extension';
export const PLAYWRIGHT_PATH_PREFIX = '/playwright/';
export const KEEPALIVE_INTERVAL_MS = 20_000;

export const relayPortCandidates = (): number[] =>
  Array.from({ length: RELAY_PORT_COUNT }, (_, i) => RELAY_PORT_BASE + i);

export const extensionEndpoint = (port: number): string =>
  `ws://${RELAY_HOST}:${port}${EXTENSION_PATH}`;

export enum HandshakeRole {
  Server = 'server',
  Extension = 'extension',
}

export enum MessageType {
  ServerChallenge = 'server-challenge',
  ExtensionChallenge = 'extension-challenge',
  ServerProof = 'server-proof',
  ExtensionProof = 'extension-proof',
  Request = 'request',
  Response = 'response',
  Event = 'event',
  Ping = 'ping',
  Pong = 'pong',
}

export const InstanceInfo = z.object({
  id: z.string().min(1),
  label: z.string(),
  brand: z.string(),
  version: z.string(),
  userAgent: z.string(),
  workerStartedAt: z.number(),
});
export type InstanceInfo = z.infer<typeof InstanceInfo>;

export const ServerChallenge = z.object({
  type: z.literal(MessageType.ServerChallenge),
  nonce: z.string().min(1),
});
export const ExtensionChallenge = z.object({
  type: z.literal(MessageType.ExtensionChallenge),
  nonce: z.string().min(1),
});
export const ServerProof = z.object({
  type: z.literal(MessageType.ServerProof),
  proof: z.string().min(1),
});
export const ExtensionProof = z.object({
  type: z.literal(MessageType.ExtensionProof),
  proof: z.string().min(1),
  instance: InstanceInfo,
});

export const TabInfo = z.object({
  id: z.number(),
  windowId: z.number(),
  index: z.number(),
  active: z.boolean(),
  url: z.string(),
  title: z.string(),
});
export type TabInfo = z.infer<typeof TabInfo>;

export const WindowInfo = z.object({
  id: z.number(),
  focused: z.boolean(),
  incognito: z.boolean(),
  tabs: z.array(TabInfo),
});
export type WindowInfo = z.infer<typeof WindowInfo>;

export const Catalog = z.object({ windows: z.array(WindowInfo) });
export type Catalog = z.infer<typeof Catalog>;

export const TargetInfo = z.object({
  targetId: z.string(),
  type: z.string(),
  title: z.string(),
  url: z.string(),
  attached: z.boolean(),
  canAccessOpener: z.boolean().optional(),
  browserContextId: z.string().optional(),
  openerId: z.string().optional(),
});
export type TargetInfo = z.infer<typeof TargetInfo>;

export enum WindowState {
  Normal = 'normal',
  Minimized = 'minimized',
  Maximized = 'maximized',
  Fullscreen = 'fullscreen',
}

export const WindowBounds = z.object({
  left: z.number().optional(),
  top: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  windowState: z.enum(WindowState).optional(),
});
export type WindowBounds = z.infer<typeof WindowBounds>;

const zTabId = z.object({ tabId: z.number() });
const zEmpty = z.object({});
const zCdpParams = z.record(z.string(), z.unknown()).optional();

export enum ExtensionMethod {
  Catalog = 'catalog',
  Attach = 'attach',
  Detach = 'detach',
  Cdp = 'cdp',
  CreateTab = 'createTab',
  CloseTab = 'closeTab',
  ActivateTab = 'activateTab',
  WindowForTab = 'windowForTab',
  SetWindowBounds = 'setWindowBounds',
}

export const ExtensionApi = {
  [ExtensionMethod.Catalog]: { params: zEmpty, result: Catalog },
  [ExtensionMethod.Attach]: { params: zTabId, result: z.object({ targetInfo: TargetInfo }) },
  [ExtensionMethod.Detach]: { params: zTabId, result: zEmpty },
  [ExtensionMethod.Cdp]: {
    params: z.object({
      tabId: z.number(),
      sessionId: z.string().optional(),
      method: z.string(),
      params: zCdpParams,
    }),
    result: z.unknown(),
  },
  [ExtensionMethod.CreateTab]: {
    params: z.object({ url: z.string(), openerTabId: z.number().optional() }),
    result: z.object({ tab: TabInfo }),
  },
  [ExtensionMethod.CloseTab]: { params: zTabId, result: zEmpty },
  [ExtensionMethod.ActivateTab]: { params: zTabId, result: zEmpty },
  [ExtensionMethod.WindowForTab]: {
    params: zTabId,
    result: z.object({ windowId: z.number(), bounds: WindowBounds }),
  },
  [ExtensionMethod.SetWindowBounds]: {
    params: z.object({ windowId: z.number(), bounds: WindowBounds }),
    result: zEmpty,
  },
} as const;

export type ParamsOf<M extends ExtensionMethod> = z.infer<(typeof ExtensionApi)[M]['params']>;
export type ResultOf<M extends ExtensionMethod> = z.infer<(typeof ExtensionApi)[M]['result']>;

export const RequestMessage = z.object({
  type: z.literal(MessageType.Request),
  id: z.number(),
  method: z.enum(ExtensionMethod),
  params: z.unknown(),
});
export type RequestMessage = z.infer<typeof RequestMessage>;

export const ResponseMessage = z.object({
  type: z.literal(MessageType.Response),
  id: z.number(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});
export type ResponseMessage = z.infer<typeof ResponseMessage>;

export enum DownloadState {
  Complete = 'complete',
  Interrupted = 'interrupted',
}

export enum ExtensionEvent {
  CdpEvent = 'cdpEvent',
  TabDetached = 'tabDetached',
  TabOpened = 'tabOpened',
  TabClosed = 'tabClosed',
  DownloadStarted = 'downloadStarted',
  DownloadFinished = 'downloadFinished',
}

export const EventPayloads = {
  [ExtensionEvent.CdpEvent]: z.object({
    tabId: z.number(),
    sessionId: z.string().optional(),
    method: z.string(),
    params: z.unknown(),
  }),
  [ExtensionEvent.TabDetached]: z.object({ tabId: z.number(), reason: z.string() }),
  [ExtensionEvent.TabOpened]: z.object({
    tabId: z.number(),
    openerTabId: z.number(),
    targetInfo: TargetInfo,
  }),
  [ExtensionEvent.TabClosed]: zTabId,
  [ExtensionEvent.DownloadStarted]: z.object({
    id: z.number(),
    url: z.string(),
    filename: z.string(),
    referrer: z.string(),
  }),
  [ExtensionEvent.DownloadFinished]: z.object({ id: z.number(), state: z.enum(DownloadState) }),
} as const;

export type PayloadOf<E extends ExtensionEvent> = z.infer<(typeof EventPayloads)[E]>;

export const EventMessage = z.object({
  type: z.literal(MessageType.Event),
  event: z.enum(ExtensionEvent),
  payload: z.unknown(),
});
export type EventMessage = z.infer<typeof EventMessage>;

export const PingMessage = z.object({ type: z.literal(MessageType.Ping) });
export const PongMessage = z.object({ type: z.literal(MessageType.Pong) });

export const ExtensionToRelay = z.discriminatedUnion('type', [
  ResponseMessage,
  EventMessage,
  PingMessage,
]);
export type ExtensionToRelay = z.infer<typeof ExtensionToRelay>;

export const RelayToExtension = z.discriminatedUnion('type', [RequestMessage, PongMessage]);
export type RelayToExtension = z.infer<typeof RelayToExtension>;
