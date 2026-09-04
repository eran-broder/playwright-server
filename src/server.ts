import * as path from 'path';
import type { StartOptions } from './browser-manager';
import { createApp } from './app';
import { createServices } from './services';
import { printEndpoints } from './endpoints-help';
import { register, unregister } from './session-registry';
import { parseBrowser, parseProfileMode } from './profile-finder';
import { parseViewportMode } from './viewport';
import { Relay } from './relay/relay';
import { KeyStore } from './relay/keys';
import { parsePairCode } from './extension/pair-code';
import type { ServerConfig } from './types';

const DEFAULT_PORT = 3456;
const ENV_TRUE = '1';
const PAIR_ENV = 'PWHS_PAIR_CODES';

const config: ServerConfig = {
  port: parseInt(process.env.PORT || String(DEFAULT_PORT)),
  scriptsDir: process.env.SCRIPTS_DIR || path.join(process.cwd(), 'scripts'),
  screenshotsDir: process.env.SCREENSHOTS_DIR || path.join(process.cwd(), 'screenshots'),
  tracesDir: process.env.TRACES_DIR || path.join(process.cwd(), 'traces'),
};

const envNumber = (name: string): number | undefined =>
  process.env[name] ? Number(process.env[name]) : undefined;

const inlinePairCodes = (): string[] =>
  (process.env[PAIR_ENV] ?? '').split(',').map((c) => c.trim()).filter(Boolean);

const defaultProfile = (codes: string[]): string | undefined =>
  codes.length > 0 ? parsePairCode(codes[0]).profileShort : undefined;

const startupOptionsFromEnv = (codes: string[]): StartOptions => ({
  browser: process.env.BROWSER ? parseBrowser(process.env.BROWSER) : undefined,
  profile: process.env.PROFILE || defaultProfile(codes),
  profileMode: process.env.PROFILE_MODE ? parseProfileMode(process.env.PROFILE_MODE) : undefined,
  userDataDir: process.env.USER_DATA_DIR || undefined,
  attach: process.env.ATTACH || undefined,
  viewport: parseViewportMode(process.env.VIEWPORT),
  extension: process.env.EXTENSION === ENV_TRUE || undefined,
  window: envNumber('WINDOW'),
  tab: envNumber('TAB'),
});

const startRelay = async (startup: StartOptions, codes: string[]): Promise<Relay | null> => {
  if (!startup.extension) return null;
  const keys = await KeyStore.load(codes);
  const relay = new Relay(keys);
  const port = await relay.listen();
  console.log(`[relay] listening on ${port} with ${keys.list().length} key(s); waiting for extension profile ${startup.profile ?? '(any)'}`);
  return relay;
};

const installCleanup = (relay: Relay | null): void => {
  const cleanup = (): void => {
    try { unregister(process.pid); } catch { return; }
    relay?.close();
  };
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);
};

const main = async (): Promise<void> => {
  const codes = inlinePairCodes();
  const startup = startupOptionsFromEnv(codes);
  const relay = await startRelay(startup, codes);
  const services = createServices(config, relay);
  const app = createApp(services);

  const server = app.listen(config.port, async () => {
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : config.port;
    console.log(`Playwright Server running on http://localhost:${actualPort}`);
    console.log('');
    printEndpoints();
    try {
      await services.browserManager.start(startup);
    } catch (err) {
      console.error('Browser failed to start:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
    console.log('Browser initialized');

    register({
      port: actualPort,
      workdir: process.cwd(),
      launchCwd: process.env.PWHS_LAUNCH_CWD,
      pid: process.pid,
      startedAt: Date.now(),
    });
    installCleanup(relay);
  });
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
