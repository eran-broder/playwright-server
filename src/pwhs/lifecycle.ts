import { list as listSessions } from '../session-registry';
import { resolvePort } from './resolve';
import { spawnServer } from './spawn';

export const up = async (serverFlags: string[]): Promise<void> => {
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
  process.stdout.write(`${fmt(headers)}\n`);
  for (const r of rows) process.stdout.write(`${fmt(r)}\n`);
};

const killAll = (): number => {
  let killed = 0;
  for (const s of listSessions()) {
    try {
      process.kill(s.pid, 'SIGTERM');
      killed++;
    } catch {
      continue;
    }
  }
  return killed;
};

export const down = (flagPort: number | undefined, args: string[]): void => {
  if (args.includes('--all')) {
    const killed = killAll();
    process.stdout.write(`Killed ${killed} server(s).\n`);
    return;
  }
  const port = resolvePort(flagPort);
  const target = listSessions().find((s) => s.port === port);
  if (!target) throw new Error(`No server registered on port ${port}`);
  process.kill(target.pid, 'SIGTERM');
  process.stdout.write(`Killed pid ${target.pid} on port ${port}.\n`);
};
