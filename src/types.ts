import type { Browser, BrowserContext, Page } from 'playwright';

// ============ Network Types ============

export type NetworkEntryType = 'request' | 'response' | 'request-failed';

export type ResourceType =
  | 'document'
  | 'stylesheet'
  | 'image'
  | 'media'
  | 'font'
  | 'script'
  | 'texttrack'
  | 'xhr'
  | 'fetch'
  | 'eventsource'
  | 'websocket'
  | 'manifest'
  | 'other';

export interface NetworkTiming {
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface NetworkEntry {
  id: string;
  timestamp: number;
  type: NetworkEntryType;
  method?: string;
  url: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  headers: Record<string, string>;
  postData?: string;
  responseBody?: string;
  timing?: NetworkTiming;
  failure?: string;
}

export interface NetworkLogFilter {
  type?: NetworkEntryType;
  resourceType?: string;
  urlPattern?: string;
  method?: string;
  status?: number;
  limit?: number;
  offset?: number;
}

export interface NetworkSummary {
  totalEntries: number;
  totalRequests: number;
  totalResponses: number;
  failedRequests: number;
  averageDuration: number;
  byType: Record<string, number>;
  byResourceType: Record<string, number>;
  byStatus: Record<number, number>;
  byDomain: Record<string, number>;
}

export interface NetworkCaptureOptions {
  captureBody?: boolean;
}

export interface NetworkCaptureState {
  enabled: boolean;
  captureBody: boolean;
  entriesCount: number;
}

// ============ Browser Types ============

export interface BrowserState {
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
}

export interface BrowserStatus {
  hasBrowser: boolean;
  hasContext: boolean;
  hasPage: boolean;
  currentUrl?: string;
  extensionPath?: string;
}

export interface BrowserStartOptions {
  extensionPath?: string;
  userDataDir?: string;
  headless?: boolean;
}

// ============ API Response Types ============

export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

// ============ Screenshot Types ============

export interface ScreenshotOptions {
  name?: string;
  fullPage?: boolean;
}

export interface ScreenshotResult {
  filename: string;
  path: string;
}

// ============ Script Types ============

export interface SaveScriptOptions {
  name: string;
  code: string;
}

export interface ExecuteScriptResult {
  stdout: string;
  stderr: string;
}

export interface ExecutePlaywrightResult {
  result: unknown;
}

// ============ Page Interaction Types ============

export interface ClickOptions {
  selector: string;
}

export interface TypeOptions {
  selector: string;
  text: string;
}

export interface WaitOptions {
  selector: string;
  timeout?: number;
}

export interface SelectOptions {
  selector: string;
  value: string;
}

export interface HoverOptions {
  selector: string;
}

export interface ScrollOptions {
  x?: number;
  y?: number;
}

export interface KeyboardOptions {
  key: string;
}

export interface NavigateOptions {
  url: string;
}

// ============ HAR Types ============

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string | undefined;
    url: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: unknown[];
    cookies: unknown[];
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number | undefined;
    statusText: string | undefined;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    cookies: unknown[];
    content: {
      size: number;
      mimeType: string;
      text: string | undefined;
    };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: Record<string, never>;
  timings: {
    send: number;
    wait: number;
    receive: number;
  };
}

export interface HarLog {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: HarEntry[];
  };
}

// ============ Server Config ============

export interface ServerConfig {
  port: number;
  scriptsDir: string;
  screenshotsDir: string;
}

// ============ Activity Recording Types ============

export type ActivityType =
  | 'network-request'
  | 'network-response'
  | 'network-failed'
  | 'console'
  | 'page-error'
  | 'navigation'
  | 'dialog'
  | 'download';

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

// ============ Interception Types ============

export interface InterceptResponse {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
  abort?: boolean;
  proxyUrl?: string; // If set, proxy the request to this URL instead of using body
}

export interface InterceptRule {
  id: string;
  urlPattern: string;
  method?: string;
  response: InterceptResponse;
  delay?: number;
  enabled: boolean;
  matchCount: number;
}

export interface AddInterceptRuleOptions {
  id?: string;
  urlPattern: string;
  method?: string;
  response: InterceptResponse;
  delay?: number;
  enabled?: boolean;
}

export interface InterceptStatus {
  enabled: boolean;
  ruleCount: number;
  totalMatches: number;
}
