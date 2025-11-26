import type { Page } from 'playwright';
import type {
  NetworkEntry,
  NetworkLogFilter,
  NetworkSummary,
  NetworkCaptureState,
  HarLog,
  HarEntry,
} from './types';

const MAX_RESPONSE_BODY_SIZE = 1024 * 1024; // 1MB

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isTextContent(contentType: string): boolean {
  return (
    contentType.includes('text') ||
    contentType.includes('json') ||
    contentType.includes('javascript') ||
    contentType.includes('xml')
  );
}

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export class NetworkMonitor {
  private entries: NetworkEntry[] = [];
  private enabled = false;
  private captureBody = false;
  private requestTimings = new Map<string, number>();

  attach(page: Page): void {
    page.on('request', (request) => this.handleRequest(request));
    page.on('response', (response) => this.handleResponse(response));
    page.on('requestfailed', (request) => this.handleRequestFailed(request));
  }

  private handleRequest(request: import('playwright').Request): void {
    if (!this.enabled) return;

    const key = request.url() + request.method();
    const startTime = Date.now();
    this.requestTimings.set(key, startTime);

    const entry: NetworkEntry = {
      id: generateId(),
      timestamp: startTime,
      type: 'request',
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      headers: request.headers(),
      postData: request.postData() || undefined,
      timing: { startTime },
    };

    this.entries.push(entry);
  }

  private async handleResponse(response: import('playwright').Response): Promise<void> {
    if (!this.enabled) return;

    const request = response.request();
    const key = request.url() + request.method();
    const endTime = Date.now();
    const startTime = this.requestTimings.get(key) || endTime;

    const entry: NetworkEntry = {
      id: generateId(),
      timestamp: endTime,
      type: 'response',
      method: request.method(),
      url: response.url(),
      resourceType: request.resourceType(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
    };

    if (this.captureBody) {
      entry.responseBody = await this.captureResponseBody(response);
    }

    this.entries.push(entry);
  }

  private async captureResponseBody(response: import('playwright').Response): Promise<string> {
    try {
      const body = await response.body();
      if (body.length > MAX_RESPONSE_BODY_SIZE) {
        return `[body too large: ${body.length} bytes]`;
      }

      const contentType = response.headers()['content-type'] || '';
      if (isTextContent(contentType)) {
        return body.toString('utf-8');
      }
      return `[base64] ${body.toString('base64').substring(0, 1000)}...`;
    } catch (e) {
      return `[failed to capture body: ${e}]`;
    }
  }

  private handleRequestFailed(request: import('playwright').Request): void {
    if (!this.enabled) return;

    const entry: NetworkEntry = {
      id: generateId(),
      timestamp: Date.now(),
      type: 'request-failed',
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      headers: request.headers(),
      failure: request.failure()?.errorText,
    };

    this.entries.push(entry);
  }

  start(captureBody = false): void {
    this.enabled = true;
    this.captureBody = captureBody;
    this.clear();
  }

  stop(): number {
    this.enabled = false;
    return this.entries.length;
  }

  clear(): number {
    const count = this.entries.length;
    this.entries = [];
    this.requestTimings.clear();
    return count;
  }

  getState(): NetworkCaptureState {
    return {
      enabled: this.enabled,
      captureBody: this.captureBody,
      entriesCount: this.entries.length,
    };
  }

  getEntries(filter: NetworkLogFilter = {}): { total: number; entries: NetworkEntry[] } {
    let filtered = [...this.entries];

    if (filter.type) {
      filtered = filtered.filter((e) => e.type === filter.type);
    }
    if (filter.resourceType) {
      filtered = filtered.filter((e) => e.resourceType === filter.resourceType);
    }
    if (filter.urlPattern) {
      const regex = new RegExp(filter.urlPattern, 'i');
      filtered = filtered.filter((e) => regex.test(e.url));
    }
    if (filter.method) {
      const method = filter.method.toUpperCase();
      filtered = filtered.filter((e) => e.method === method);
    }
    if (filter.status !== undefined) {
      filtered = filtered.filter((e) => e.status === filter.status);
    }

    const total = filtered.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 1000;
    filtered = filtered.slice(offset, offset + limit);

    return { total, entries: filtered };
  }

  getSummary(): NetworkSummary {
    const byType: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};
    const byStatus: Record<number, number> = {};
    const byDomain: Record<string, number> = {};
    let totalRequests = 0;
    let totalResponses = 0;
    let failedRequests = 0;
    let totalDuration = 0;
    let responsesWithTiming = 0;

    for (const entry of this.entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      byResourceType[entry.resourceType] = (byResourceType[entry.resourceType] || 0) + 1;

      if (entry.status !== undefined) {
        byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
      }

      const url = safeParseUrl(entry.url);
      if (url) {
        byDomain[url.hostname] = (byDomain[url.hostname] || 0) + 1;
      }

      if (entry.type === 'request') totalRequests++;
      if (entry.type === 'response') totalResponses++;
      if (entry.type === 'request-failed') failedRequests++;

      if (entry.timing?.duration) {
        totalDuration += entry.timing.duration;
        responsesWithTiming++;
      }
    }

    return {
      totalEntries: this.entries.length,
      totalRequests,
      totalResponses,
      failedRequests,
      averageDuration: responsesWithTiming > 0 ? Math.round(totalDuration / responsesWithTiming) : 0,
      byType,
      byResourceType,
      byStatus,
      byDomain,
    };
  }

  exportHar(): HarLog {
    const entries: HarEntry[] = this.entries
      .filter((e) => e.type === 'response')
      .map((e) => ({
        startedDateTime: new Date(e.timing?.startTime || e.timestamp).toISOString(),
        time: e.timing?.duration || 0,
        request: {
          method: e.method,
          url: e.url,
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(e.headers || {}).map(([name, value]) => ({ name, value })),
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: -1,
        },
        response: {
          status: e.status,
          statusText: e.statusText,
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(e.headers || {}).map(([name, value]) => ({ name, value })),
          cookies: [],
          content: {
            size: e.responseBody?.length || 0,
            mimeType: e.headers?.['content-type'] || 'application/octet-stream',
            text: e.responseBody,
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: e.responseBody?.length || -1,
        },
        cache: {},
        timings: {
          send: 0,
          wait: e.timing?.duration || 0,
          receive: 0,
        },
      }));

    return {
      log: {
        version: '1.2',
        creator: {
          name: 'Playwright Server',
          version: '1.0.0',
        },
        entries,
      },
    };
  }
}
