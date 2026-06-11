import * as fs from 'fs';
import * as path from 'path';
import { BrowserKind, userDataDirOf } from './profile-finder';

const PROBE_TIMEOUT_MS = 2000;
const DEFAULT_DEBUG_PORT = 9222;
const AUTO_SPEC = 'auto';

const ENABLE_HINT =
  'Enable remote debugging (chrome://inspect/#remote-debugging on Chrome 146+, ' +
  'or launch with --remote-debugging-port)';

const probe = async (baseUrl: string): Promise<boolean> => {
  try {
    const url = new URL('/json/version', baseUrl).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
};

const portFromDevToolsActivePort = (browser: BrowserKind): number | null => {
  const dir = userDataDirOf(browser);
  if (!dir) return null;
  const file = path.join(dir, 'DevToolsActivePort');
  if (!fs.existsSync(file)) return null;
  const firstLine = fs.readFileSync(file, 'utf-8').split(/\r?\n/)[0].trim();
  const port = Number(firstLine);
  return Number.isInteger(port) && port > 0 ? port : null;
};

const autoCandidates = (): string[] => {
  const ports = [
    portFromDevToolsActivePort(BrowserKind.Chrome),
    portFromDevToolsActivePort(BrowserKind.Edge),
    DEFAULT_DEBUG_PORT,
  ].filter((p): p is number => p !== null);
  return [...new Set(ports)].map((p) => `http://localhost:${p}`);
};

const toUrl = (spec: string): string =>
  /^\d+$/.test(spec) ? `http://localhost:${spec}` : spec;

const resolveExplicit = async (spec: string): Promise<string> => {
  const url = toUrl(spec);
  if (!(await probe(url))) {
    throw new Error(`No CDP endpoint responding at ${url}. ${ENABLE_HINT} and retry.`);
  }
  return url;
};

const resolveAuto = async (): Promise<string> => {
  const candidates = autoCandidates();
  for (const url of candidates) {
    if (await probe(url)) return url;
  }
  throw new Error(
    `--attach auto: no live CDP endpoint found (tried ${candidates.join(', ')}). ` +
      `${ENABLE_HINT}, or pass an explicit URL/port.`,
  );
};

export const resolveAttachUrl = (spec: string): Promise<string> =>
  spec === AUTO_SPEC ? resolveAuto() : resolveExplicit(spec);
