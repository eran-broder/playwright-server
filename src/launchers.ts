import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  BrowserKind,
  Channel,
  CRITICAL_PROFILE_FILES,
  ProfileMode,
  prepareUserDataDir,
} from './profile-finder';
import { resolveAttachUrl } from './cdp-finder';

export enum LaunchMode {
  Ephemeral = 'ephemeral',
  Persistent = 'persistent',
  Attached = 'attached',
  Extension = 'extension',
}

export type DeviceConfig = Parameters<Browser['newContext']>[0];

export interface Launched {
  browser: Browser | null;
  context: BrowserContext;
  page: Page;
  mode: LaunchMode;
  pages: Page[];
}

export interface PersistentOptions {
  browser?: BrowserKind;
  profile?: string;
  profileMode?: ProfileMode;
  userDataDir?: string;
}

const storageStatePath = (): string | undefined => {
  const authPath = process.env.AUTH_PATH || path.join(process.cwd(), 'auth.json');
  if (!fs.existsSync(authPath)) return undefined;
  console.log('Loading auth state from ' + authPath);
  return authPath;
};

const warnSkippedCriticalFiles = (skipped: string[], browser: BrowserKind): void => {
  const critical = skipped.filter((p) => CRITICAL_PROFILE_FILES.includes(path.basename(p)));
  if (critical.length === 0) return;
  console.warn(
    `[warning] Could not copy ${critical.length} critical file(s) — likely locked by a running ${browser} instance:`,
  );
  critical.forEach((p) => console.warn(`  ${p}`));
  console.warn(`Close ${browser} fully and restart the server for cookies/logins to transfer.`);
};

export const launchEphemeral = async (channel: Channel, deviceConfig: DeviceConfig): Promise<Launched> => {
  const browser = await chromium.launch({ headless: false, channel });
  const storageState = storageStatePath();
  const context = await browser.newContext(storageState ? { ...deviceConfig, storageState } : deviceConfig);
  const page = await context.newPage();
  return { browser, context, page, mode: LaunchMode.Ephemeral, pages: [page] };
};

export const launchPersistent = async (
  opts: PersistentOptions,
  channel: Channel,
  deviceConfig: DeviceConfig,
): Promise<Launched> => {
  const browser = opts.browser ?? BrowserKind.Chromium;
  const profile = opts.profile ?? 'Default';
  const mode = opts.profileMode ?? ProfileMode.Copy;
  const setup = await prepareUserDataDir(browser, profile, mode, process.cwd(), opts.userDataDir);
  console.log(`Launching ${browser} with profile "${profile}" (${mode}) at ${setup.userDataDir}`);
  warnSkippedCriticalFiles(setup.skipped, browser);

  const context = await chromium.launchPersistentContext(setup.userDataDir, {
    headless: false,
    channel,
    args: [setup.profileArg],
    ...deviceConfig,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  return { browser: context.browser(), context, page, mode: LaunchMode.Persistent, pages: [page] };
};

export const connectAttached = async (spec: string): Promise<Launched> => {
  const url = await resolveAttachUrl(spec);
  console.log(`Attaching over CDP: ${url}`);
  const browser = await chromium.connectOverCDP(url);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const existing = context.pages();
  const page = existing[existing.length - 1] ?? (await context.newPage());
  return { browser, context, page, mode: LaunchMode.Attached, pages: existing.length ? existing : [page] };
};
