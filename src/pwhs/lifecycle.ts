import { list as listSessions } from '../session-registry';
import { loadOrCreateToken } from '../relay/token';
import { resolvePort } from './resolve';
import { spawnServer } from './spawn';

export enum LifecycleVerb {
  Up = 'up',
  Down = 'down',
  Ls = 'ls',
  Token = 'token',
  Pair = 'pair',
}

const EXTENSION_FLAG = '--extension';
const ALL_FLAG = '--all';

export const up = async (serverFlags: string[]): Promise<void> => {
  if (serverFlags.includes(EXTENSION_FLAG)) {
    process.stderr.write('waiting for the pwhs extension to connect (click its icon to connect now)…\n');
  }
  const { port } = await spawnServer(serverFlags);
  process.stdout.write(`${port}\n`);
};

export const token = (): void => {
  process.stdout.write(`${loadOrCreateToken()}\n`);
};

const formatAge = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
};

export const ls = (): void => {
  const sessions = listSessions();
  if (sessions.length === 0) {
    process.stderr.write('No servers running.\n');
    return;
  }
  const now = Date.now();
  const headers = ['PORT', 'AGE', 'PID', 'LAUNCHED-FROM', 'WORKDIR'];
  const rows = sessions.map((s) => [
    String(s.port),
    formatAge(now - s.startedAt),
    String(s.pid),
    s.launchCwd ?? '-',
    s.workdir,
  ]);
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  process.stdout.write([headers, ...rows].map((cells) => `${fmt(cells)}\n`).join(''));
};

const tryKill = (pid: number): boolean => {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
};

const killAll = (): number => listSessions().filter((s) => tryKill(s.pid)).length;

export const down = (flagPort: number | undefined, args: string[]): void => {
  if (args.includes(ALL_FLAG)) {
    const killed = killAll();
    process.stdout.write(`Killed ${killed} server(s).\n`);
    return;
  }
  const port = resolvePort(flagPort);
  const target = listSessions().find((s) => s.port === port);
  if (!target) throw new Error(`No server registered on port ${port}`);
  if (!tryKill(target.pid)) throw new Error(`Could not signal pid ${target.pid}`);
  process.stdout.write(`Killed pid ${target.pid} on port ${port}.\n`);
};
