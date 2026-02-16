import type { Page } from 'playwright';
import type {
  ActivityType,
  ActivityEntry,
  ActivityFilter,
  ActivitySummary,
  RecordingState,
  ConsoleEntry,
  ConsoleMessageType,
  PageErrorEntry,
  NavigationEntry,
  DialogEntry,
} from './types';

const MAX_ENTRIES = 10000;
const MAX_RESPONSE_BODY_SIZE = 1024 * 1024; // 1MB

function isTextContent(contentType: string): boolean {
  return (
    contentType.includes('text') ||
    contentType.includes('json') ||
    contentType.includes('javascript') ||
    contentType.includes('xml')
  );
}

export class ActivityRecorder {
  private entries: ActivityEntry[] = [];
  private nextId = 1;
  private enabled = false;
  private autoStart = true;
  private captureNetworkBodies = false;
  private requestTimings = new Map<string, number>();

  attach(page: Page): void {
    // Network events
    page.on('request', (request) => this.handleRequest(request));
    page.on('response', (response) => this.handleResponse(response));
    page.on('requestfailed', (request) => this.handleRequestFailed(request));

    // Console events
    page.on('console', (msg) => this.handleConsole(msg));

    // Error events
    page.on('pageerror', (error) => this.handlePageError(error));

    // Navigation events
    page.on('load', () => this.handleNavigation(page, 'load'));
    page.on('domcontentloaded', () => this.handleNavigation(page, 'domcontentloaded'));
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        this.handleNavigation(page, 'framenavigated');
      }
    });

    // Dialog events
    page.on('dialog', (dialog) => this.handleDialog(dialog));

    // Auto-start if configured
    if (this.autoStart) {
      this.enabled = true;
    }
  }

  private addEntry(type: ActivityType, data: unknown): void {
    if (!this.enabled) return;

    const entry: ActivityEntry = {
      id: this.nextId++,
      timestamp: Date.now(),
      type,
      data,
    };

    this.entries.push(entry);

    // Trim old entries if we exceed max
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
  }

  private handleRequest(request: import('playwright').Request): void {
    const key = request.url() + request.method();
    this.requestTimings.set(key, Date.now());

    this.addEntry('network-request', {
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      headers: request.headers(),
      postData: request.postData() || undefined,
    });
  }

  private async handleResponse(response: import('playwright').Response): Promise<void> {
    if (!this.enabled) return;

    const request = response.request();
    const key = request.url() + request.method();
    const startTime = this.requestTimings.get(key);
    const duration = startTime ? Date.now() - startTime : undefined;

    let responseBody: string | undefined;
    if (this.captureNetworkBodies) {
      responseBody = await this.captureResponseBody(response);
    }

    this.addEntry('network-response', {
      method: request.method(),
      url: response.url(),
      resourceType: request.resourceType(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      duration,
      responseBody,
    });
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
      return `[binary: ${body.length} bytes]`;
    } catch (e) {
      return `[failed to capture: ${e}]`;
    }
  }

  private handleRequestFailed(request: import('playwright').Request): void {
    this.addEntry('network-failed', {
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText,
    });
  }

  private handleConsole(msg: import('playwright').ConsoleMessage): void {
    const location = msg.location();
    const entry: ConsoleEntry = {
      messageType: msg.type() as ConsoleMessageType,
      text: msg.text(),
      location: location.url ? {
        url: location.url,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber,
      } : undefined,
    };

    this.addEntry('console', entry);
  }

  private handlePageError(error: Error): void {
    const entry: PageErrorEntry = {
      message: error.message,
      stack: error.stack,
    };

    this.addEntry('page-error', entry);
  }

  private handleNavigation(page: Page, eventType: 'load' | 'domcontentloaded' | 'framenavigated'): void {
    const entry: NavigationEntry = {
      url: page.url(),
      eventType,
    };

    this.addEntry('navigation', entry);
  }

  private async handleDialog(dialog: import('playwright').Dialog): Promise<void> {
    const entry: DialogEntry = {
      dialogType: dialog.type() as DialogEntry['dialogType'],
      message: dialog.message(),
      defaultValue: dialog.defaultValue() || undefined,
      handled: false,
    };

    this.addEntry('dialog', entry);

    // Auto-dismiss dialogs to prevent blocking
    await dialog.dismiss().catch(() => {});
  }

  // ============ Control Methods ============

  start(options: { captureNetworkBodies?: boolean } = {}): void {
    this.enabled = true;
    this.captureNetworkBodies = options.captureNetworkBodies ?? false;
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

  setAutoStart(enabled: boolean): void {
    this.autoStart = enabled;
  }

  // ============ Query Methods ============

  getState(): RecordingState {
    return {
      enabled: this.enabled,
      autoStart: this.autoStart,
      captureNetworkBodies: this.captureNetworkBodies,
      entryCount: this.entries.length,
      watermark: this.nextId - 1,
    };
  }

  /**
   * Get entries with optional filtering.
   * The `since` parameter is the key feature - it returns only entries
   * with id > since, allowing clients to poll for new events.
   */
  getEntries(filter: ActivityFilter = {}): {
    entries: ActivityEntry[];
    watermark: number;
    hasMore: boolean;
  } {
    let filtered = [...this.entries];

    // Filter by id (watermark) - only return entries newer than 'since'
    if (filter.since !== undefined) {
      filtered = filtered.filter((e) => e.id > filter.since!);
    }

    // Filter by types
    if (filter.types && filter.types.length > 0) {
      filtered = filtered.filter((e) => filter.types!.includes(e.type));
    }

    // Apply limit
    const limit = filter.limit ?? 1000;
    const hasMore = filtered.length > limit;
    filtered = filtered.slice(0, limit);

    // Return current watermark for next query
    const watermark = this.nextId - 1;

    return { entries: filtered, watermark, hasMore };
  }

  /**
   * Convenience method to get all new activity since last check.
   * Returns entries and updates the internal "last seen" marker.
   */
  poll(since: number, types?: ActivityType[]): {
    entries: ActivityEntry[];
    watermark: number;
    summary: { [key in ActivityType]?: number };
  } {
    const { entries, watermark } = this.getEntries({ since, types, limit: 5000 });

    // Build a quick summary by type
    const summary: { [key in ActivityType]?: number } = {};
    for (const entry of entries) {
      summary[entry.type] = (summary[entry.type] || 0) + 1;
    }

    return { entries, watermark, summary };
  }

  getSummary(): ActivitySummary {
    const byType: Record<string, number> = {};
    let oldestTimestamp: number | undefined;
    let newestTimestamp: number | undefined;

    for (const entry of this.entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;

      if (oldestTimestamp === undefined || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (newestTimestamp === undefined || entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }

    return {
      totalEntries: this.entries.length,
      currentWatermark: this.nextId - 1,
      byType,
      oldestTimestamp,
      newestTimestamp,
    };
  }

  /**
   * Get a compact summary suitable for quick status checks.
   * Useful for knowing if anything happened without fetching all data.
   */
  getQuickStatus(since?: number): {
    newEntries: number;
    watermark: number;
    hasConsoleErrors: boolean;
    hasPageErrors: boolean;
    hasNetworkFailures: boolean;
    lastActivityTime?: number;
  } {
    let entries = this.entries;
    if (since !== undefined) {
      entries = entries.filter((e) => e.id > since);
    }

    const hasConsoleErrors = entries.some(
      (e) => e.type === 'console' && (e.data as ConsoleEntry).messageType === 'error'
    );
    const hasPageErrors = entries.some((e) => e.type === 'page-error');
    const hasNetworkFailures = entries.some((e) => e.type === 'network-failed');
    const lastEntry = entries[entries.length - 1];

    return {
      newEntries: entries.length,
      watermark: this.nextId - 1,
      hasConsoleErrors,
      hasPageErrors,
      hasNetworkFailures,
      lastActivityTime: lastEntry?.timestamp,
    };
  }
}
