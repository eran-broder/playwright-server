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
