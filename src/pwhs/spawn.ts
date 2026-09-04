import { spawn } from 'child_process';
import * as path from 'path';
import { list as listSessions } from '../session-registry';

const SERVER_REGISTER_TIMEOUT_MS = 120_000;
const SERVER_POLL_INTERVAL_MS = 150;
const CLI_PATH = path.join(__dirname, '..', 'cli.js');
const PAIR_FLAG = '--pair';
const PAIR_ENV = 'PWHS_PAIR_CODES';

const splitPairFlags = (flags: string[]): { flags: string[]; codes: string[] } => {
  const codes = flags.flatMap((f, i) => (f === PAIR_FLAG && flags[i + 1] ? [flags[i + 1]] : []));
  const rest = flags.filter((f, i) => f !== PAIR_FLAG && flags[i - 1] !== PAIR_FLAG);
  return { flags: rest, codes };
};

const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

export interface SpawnedServer {
  port: number;
  pid: number;
}

export const spawnServer = async (serverFlags: string[]): Promise<SpawnedServer> => {
  const { flags, codes } = splitPairFlags(serverFlags);
  const env = codes.length ? { ...process.env, [PAIR_ENV]: codes.join(',') } : process.env;
  const child = spawn(process.execPath, [CLI_PATH, ...flags], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env,
  });
  let exited: number | null = null;
  child.on('exit', (code) => { exited = code ?? 1; });
  child.unref();
  const pid = child.pid;
  if (!pid) throw new Error('Failed to spawn server');

  const deadline = Date.now() + SERVER_REGISTER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const entry = listSessions().find((s) => s.pid === pid);
    if (entry) return { port: entry.port, pid };
    if (exited !== null) throw new Error(`Server exited with code ${exited} before registering (see its server.log in the tempdir)`);
    await sleep(SERVER_POLL_INTERVAL_MS);
  }
  throw new Error(
    `Server (pid ${pid}) did not register within ${SERVER_REGISTER_TIMEOUT_MS / 1000}s`,
  );
};
