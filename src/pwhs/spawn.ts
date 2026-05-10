import { spawn } from 'child_process';
import * as path from 'path';
import { list as listSessions } from '../session-registry';

const SERVER_REGISTER_TIMEOUT_MS = 60_000;
const SERVER_POLL_INTERVAL_MS = 150;
const CLI_PATH = path.join(__dirname, '..', 'cli.js');

const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

export interface SpawnedServer {
  port: number;
  pid: number;
}

export const spawnServer = async (serverFlags: string[]): Promise<SpawnedServer> => {
  const child = spawn(process.execPath, [CLI_PATH, ...serverFlags], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  const pid = child.pid;
  if (!pid) throw new Error('Failed to spawn server');

  const deadline = Date.now() + SERVER_REGISTER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const entry = listSessions().find((s) => s.pid === pid);
    if (entry) return { port: entry.port, pid };
    await sleep(SERVER_POLL_INTERVAL_MS);
  }
  throw new Error(
    `Server (pid ${pid}) did not register within ${SERVER_REGISTER_TIMEOUT_MS / 1000}s`,
  );
};
