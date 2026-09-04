import { list as listSessions } from '../session-registry';
import { assertLive, resolveKey } from '../relay/keys';
import { resolvePort } from './resolve';
import { spawnServer } from './spawn';

export enum LifecycleVerb {
  Up = 'up',
  Down = 'down',
  Ls = 'ls',
  Keys = 'keys',
}

const EXTENSION_FLAG = '--extension';
const PAIR_FLAG = '--pair';
const ALL_FLAG = '--all';

const pairCodesIn = (flags: string[]): string[] =>
  flags.flatMap((f, i) => (f === PAIR_FLAG && flags[i + 1] ? [flags[i + 1]] : []));

const validatePairCodes = (flags: string[]): Promise<void> =>
  Promise.all(pairCodesIn(flags).map((code) => resolveKey({ code, name: 'inline', addedAt: Date.now() }).then(assertLive)))
    .then(() => undefined);

export const up = async (serverFlags: string[]): Promise<void> => {
  await validatePairCodes(serverFlags);
  if (serverFlags.includes(EXTENSION_FLAG)) {
    process.stderr.write('waiting for the pwhs extension to connect (it searches every few seconds; click its icon to connect now)…\n');
  }
  const { port } = await spawnServer(serverFlags);
  process.stdout.write(`${port}\n`);
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
