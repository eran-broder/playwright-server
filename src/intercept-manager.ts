import type { Page, Route } from 'playwright';
import type {
  InterceptRule,
  AddInterceptRuleOptions,
  InterceptStatus,
} from './types';

export class InterceptManager {
  private rules = new Map<string, InterceptRule>();
  private enabled = true;
  private nextId = 1;
  private attachedPage: Page | null = null;

  /**
   * Attach to a page and set up route interception
   */
  attach(page: Page): void {
    // Detach from previous page if any
    if (this.attachedPage) {
      this.detach();
    }

    this.attachedPage = page;

    // Set up a catch-all route that checks all rules
    page.route('**/*', (route) => this.handleRoute(route));
  }

  /**
   * Detach from the current page
   */
  detach(): void {
    if (this.attachedPage) {
      try {
        // Check if page is closed before unrouting
        if (!this.attachedPage.isClosed()) {
          this.attachedPage.unroute('**/*');
        }
      } catch (error) {
        // Ignore errors if page is already closed
        console.log('[Intercept] Failed to unroute:', error);
      }
      this.attachedPage = null;
    }
  }

  /**
   * Handle an intercepted route
   */
  private async handleRoute(route: Route): Promise<void> {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    console.log(`[Intercept] ${method} ${url}`);

    // If interception is globally disabled, just continue
    if (!this.enabled) {
      console.log('[Intercept] Globally disabled, continuing');
      await route.continue();
      return;
    }

    // Find a matching rule
    const matchingRule = this.findMatchingRule(url, method);

    if (!matchingRule) {
      // No match, continue with the request
      console.log('[Intercept] No matching rule, continuing');
      await route.continue();
      return;
    }

    console.log(`[Intercept] Matched rule: ${matchingRule.id}`);

    // Increment match count
    matchingRule.matchCount++;

    // Apply delay if specified
    if (matchingRule.delay && matchingRule.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, matchingRule.delay));
    }

    // Handle the response
    const { response } = matchingRule;

    if (response.abort) {
      // Abort the request (simulate network failure)
      await route.abort('failed');
      return;
    }

    // If proxyUrl is specified, fetch from that URL and return the response
    if (response.proxyUrl) {
      try {
        // Build the full proxy URL by extracting the path from the original request
        // e.g., https://connect.staging.getvim.com/vim-os → http://localhost:9000/vim-os
        const requestUrl = new URL(url);
        const targetUrl = response.proxyUrl + requestUrl.pathname + requestUrl.search;

        console.log(`[Intercept] Proxying ${url} → ${targetUrl}`);
        const proxyResponse = await fetch(targetUrl);
        const proxyBody = await proxyResponse.text();
        const proxyHeaders: Record<string, string> = {};

        // Copy relevant headers from proxy response
        proxyResponse.headers.forEach((value, key) => {
          // Skip certain headers that shouldn't be forwarded
          if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
            proxyHeaders[key] = value;
          }
        });

        // Merge with any custom headers from the rule
        const finalHeaders = { ...proxyHeaders, ...(response.headers || {}) };

        await route.fulfill({
          status: response.status ?? proxyResponse.status,
          headers: finalHeaders,
          body: proxyBody,
        });
        return;
      } catch (error) {
        console.error(`[Intercept] Proxy error:`, error);
        await route.fulfill({
          status: 500,
          body: `Proxy error: ${error}`,
        });
        return;
      }
    }

    // Fulfill with custom response
    await route.fulfill({
      status: response.status ?? 200,
      headers: response.headers ?? {},
      body: response.body ?? '',
    });
  }

  /**
   * Find the first matching rule for a URL and method
   */
  private findMatchingRule(url: string, method: string): InterceptRule | null {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check URL pattern
      const urlRegex = new RegExp(rule.urlPattern);
      if (!urlRegex.test(url)) continue;

      // Check method if specified
      if (rule.method && rule.method.toUpperCase() !== method.toUpperCase()) {
        continue;
      }

      // Found a match
      return rule;
    }

    return null;
  }

  /**
   * Add a new interception rule
   */
  addRule(options: AddInterceptRuleOptions): InterceptRule {
    // Generate ID if not provided
    const id = options.id || `rule-${this.nextId++}`;

    // Check if ID already exists
    if (this.rules.has(id)) {
      throw new Error(`Rule with id '${id}' already exists`);
    }

    // Create the rule
    const rule: InterceptRule = {
      id,
      urlPattern: options.urlPattern,
      method: options.method,
      response: options.response,
      delay: options.delay ?? 0,
      enabled: options.enabled ?? true,
      matchCount: 0,
    };

    this.rules.set(id, rule);

    return rule;
  }

  /**
   * Remove a rule by ID
   */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Get a rule by ID
   */
  getRule(id: string): InterceptRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all rules
   */
  listRules(): InterceptRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Clear all rules
   */
  clearRules(): number {
    const count = this.rules.size;
    this.rules.clear();
    return count;
  }

  /**
   * Toggle a specific rule
   */
  toggleRule(id: string, enabled: boolean): InterceptRule {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule with id '${id}' not found`);
    }

    rule.enabled = enabled;
    return rule;
  }

  /**
   * Enable or disable all interception
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get interception status
   */
  getStatus(): InterceptStatus {
    const totalMatches = Array.from(this.rules.values()).reduce(
      (sum, rule) => sum + rule.matchCount,
      0
    );

    return {
      enabled: this.enabled,
      ruleCount: this.rules.size,
      totalMatches,
    };
  }

  /**
   * Check if interception is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
