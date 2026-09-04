export interface BrowserStatus {
  hasBrowser: boolean;
  hasContext: boolean;
  hasPage: boolean;
  currentUrl?: string;
  mode?: string;
  profile?: string;
  relayPort?: number;
}

export interface PageInfo {
  index: number;
  url: string;
  title: string;
  tabId?: number;
  windowId?: number;
  active?: boolean;
  attached?: boolean;
}

export interface ScreenshotResult {
  filename: `${string}.png`;
  path: string;
}

export interface ExecuteScriptResult {
  stdout: string;
  stderr: string;
}

export enum WaitUntil {
  Load = 'load',
  DomContentLoaded = 'domcontentloaded',
  NetworkIdle = 'networkidle',
  Commit = 'commit',
}

export enum SnapshotMode {
  Default = 'default',
  Ai = 'ai',
}

export interface SnapshotOptions {
  mode?: SnapshotMode;
  boxes?: boolean;
  depth?: number;
}

export interface ServerConfig {
  port: number;
  scriptsDir: string;
  screenshotsDir: string;
  tracesDir: string;
}

export type ActivityType =
  | 'network-request'
  | 'network-response'
  | 'network-failed'
  | 'console'
  | 'page-error'
  | 'navigation'
  | 'dialog'
  | 'download'
  | 'websocket';

export type ConsoleMessageType = 'log' | 'debug' | 'info' | 'error' | 'warning' | 'dir' | 'trace' | 'assert';

export interface ActivityEntry {
  id: number;
  timestamp: number;
  type: ActivityType;
  data: unknown;
}

export interface ConsoleEntry {
  messageType: ConsoleMessageType;
  text: string;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  args?: string[];
}

export interface PageErrorEntry {
  message: string;
  stack?: string;
}

export interface NavigationEntry {
  url: string;
  eventType: 'load' | 'domcontentloaded' | 'framenavigated';
}

export interface DownloadEntry {
  url: string;
  suggestedFilename: string;
}

export enum WebSocketEventType {
  Open = 'open',
  Sent = 'sent',
  Received = 'received',
  Close = 'close',
}

export interface WebSocketEntry {
  event: WebSocketEventType;
  url: string;
  payload?: string;
}

export interface DialogEntry {
  dialogType: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  message: string;
  defaultValue?: string;
  handled: boolean;
  response?: string;
}

export interface ActivityFilter {
  types?: ActivityType[];
  since?: number;
  limit?: number;
}

export interface ActivitySummary {
  totalEntries: number;
  currentWatermark: number;
  byType: Record<string, number>;
  oldestTimestamp?: number;
  newestTimestamp?: number;
}

export interface RecordingState {
  enabled: boolean;
  autoStart: boolean;
  captureNetworkBodies: boolean;
  entryCount: number;
  watermark: number;
}
