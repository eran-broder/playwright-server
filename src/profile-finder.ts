import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export enum BrowserKind {
  Chromium = 'chromium',
  Edge = 'edge',
  Chrome = 'chrome',
}

export enum ProfileMode {
  Copy = 'copy',
  Live = 'live',
}

export type Channel = 'msedge' | 'chrome' | undefined;

const isBrowserKind = (s: string): s is BrowserKind =>
  (Object.values(BrowserKind) as string[]).includes(s);

const isProfileMode = (s: string): s is ProfileMode =>
  (Object.values(ProfileMode) as string[]).includes(s);

export const parseBrowser = (s: string | undefined): BrowserKind => {
  if (!s) return BrowserKind.Chromium;
  if (!isBrowserKind(s)) {
    throw new Error(`Invalid --browser: ${s}. Use chromium, edge, or chrome.`);
  }
  return s;
};

export const parseProfileMode = (s: string | undefined): ProfileMode => {
  if (!s) return ProfileMode.Copy;
  if (!isProfileMode(s)) {
    throw new Error(`Invalid --profile-mode: ${s}. Use copy or live.`);
  }
  return s;
};

export const channelFor = (browser: BrowserKind): Channel => {
  if (browser === BrowserKind.Edge) return 'msedge';
  if (browser === BrowserKind.Chrome) return 'chrome';
  return undefined;
};

const userDataDirOf = (browser: BrowserKind): string | null => {
  if (browser === BrowserKind.Chromium) return null;
  const subpath: Record<NodeJS.Platform, Partial<Record<BrowserKind, string[]>>> = {
    win32: {
      [BrowserKind.Edge]: ['Microsoft', 'Edge', 'User Data'],
      [BrowserKind.Chrome]: ['Google', 'Chrome', 'User Data'],
    },
    darwin: {
      [BrowserKind.Edge]: ['Library', 'Application Support', 'Microsoft Edge'],
      [BrowserKind.Chrome]: ['Library', 'Application Support', 'Google', 'Chrome'],
    },
    linux: {
      [BrowserKind.Edge]: ['.config', 'microsoft-edge'],
      [BrowserKind.Chrome]: ['.config', 'google-chrome'],
    },
  } as Record<NodeJS.Platform, Partial<Record<BrowserKind, string[]>>>;

  const segs = subpath[process.platform]?.[browser];
  if (!segs) return null;

  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA;
    return base ? path.join(base, ...segs) : null;
  }
  return path.join(os.homedir(), ...segs);
};

const listProfiles = (userDataDir: string): string[] => {
  if (!fs.existsSync(userDataDir)) return [];
  return fs
    .readdirSync(userDataDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => n === 'Default' || n.startsWith('Profile'));
};

export const resolveUserDataDir = (browser: BrowserKind, override?: string): string => {
  if (override) {
    if (!fs.existsSync(override)) {
      throw new Error(`User-data-dir does not exist: ${override}`);
    }
    return override;
  }
  const dir = userDataDirOf(browser);
  if (!dir) {
    throw new Error(`No default user-data-dir for ${browser}; specify --user-data-dir.`);
  }
  if (!fs.existsSync(dir)) {
    throw new Error(`User-data-dir does not exist: ${dir} (is ${browser} installed?)`);
  }
  return dir;
};

const SKIP_DIRS = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'GrShaderCache',
  'ShaderCache',
  'Application Cache',
  'Service Worker',
  'Crashpad',
  'Crash Reports',
  'BrowserMetrics',
  'optimization_guide_model_store',
  'component_crx_cache',
  'extensions_crx_cache',
]);

const tryCopyFile = async (src: string, dst: string): Promise<boolean> => {
  try {
    await fs.promises.copyFile(src, dst);
    return true;
  } catch {
    return false;
  }
};

const recursiveCopy = async (
  src: string,
  dst: string,
  sourceRoot: string,
  skipped: string[],
): Promise<void> => {
  await fs.promises.mkdir(dst, { recursive: true });
  for (const entry of await fs.promises.readdir(src, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const sp = path.join(src, entry.name);
    const dp = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await recursiveCopy(sp, dp, sourceRoot, skipped);
    } else if (entry.isFile()) {
      const ok = await tryCopyFile(sp, dp);
      if (!ok) skipped.push(path.relative(sourceRoot, sp));
    }
  }
};

const copyProfileTree = async (
  sourceUserDataDir: string,
  targetUserDataDir: string,
  profileName: string,
): Promise<string[]> => {
  const skipped: string[] = [];
  await fs.promises.mkdir(targetUserDataDir, { recursive: true });
  for (const entry of await fs.promises.readdir(sourceUserDataDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const sp = path.join(sourceUserDataDir, entry.name);
    const dp = path.join(targetUserDataDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === profileName) {
        await recursiveCopy(sp, dp, sourceUserDataDir, skipped);
      }
    } else if (entry.isFile()) {
      const ok = await tryCopyFile(sp, dp);
      if (!ok) skipped.push(path.relative(sourceUserDataDir, sp));
    }
  }
  return skipped;
};

const ensureProfileExists = (userDataDir: string, profile: string): void => {
  const profileDir = path.join(userDataDir, profile);
  if (fs.existsSync(profileDir)) return;
  const available = listProfiles(userDataDir);
  const hint = available.length > 0 ? ` Available: ${available.join(', ')}` : '';
  throw new Error(`Profile not found: ${profile} in ${userDataDir}.${hint}`);
};

export interface ProfileSetup {
  userDataDir: string;
  profileArg: string;
  skipped: string[];
}

export const CRITICAL_PROFILE_FILES = ['Cookies', 'Login Data'];

export const prepareUserDataDir = async (
  browser: BrowserKind,
  profile: string,
  mode: ProfileMode,
  workdir: string,
  override?: string,
): Promise<ProfileSetup> => {
  const sourceDir = resolveUserDataDir(browser, override);
  ensureProfileExists(sourceDir, profile);

  const profileArg = `--profile-directory=${profile}`;

  if (mode === ProfileMode.Live) {
    return { userDataDir: sourceDir, profileArg, skipped: [] };
  }

  const targetDir = path.join(workdir, 'browser-profile');
  const skipped = await copyProfileTree(sourceDir, targetDir, profile);
  return { userDataDir: targetDir, profileArg, skipped };
};
