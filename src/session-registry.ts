import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface SessionEntry {
  port: number;
  workdir: string;
  pid: number;
  startedAt: number;
}

function configDir(): string {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'pwhs');
  }
  const xdg = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(xdg, 'pwhs');
}

function sessionsFile(): string {
  return path.join(configDir(), 'sessions.json');
}

function readRaw(): SessionEntry[] {
  const f = sessionsFile();
  if (!fs.existsSync(f)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: SessionEntry[]): void {
  const f = sessionsFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(entries, null, 2));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function list(): SessionEntry[] {
  const all = readRaw();
  const alive = all.filter((e) => isAlive(e.pid));
  if (alive.length !== all.length) writeRaw(alive);
  return alive;
}

export function register(entry: SessionEntry): void {
  const all = readRaw().filter((e) => e.pid !== entry.pid && e.port !== entry.port);
  all.push(entry);
  writeRaw(all);
}

export function unregister(pid: number): void {
  const all = readRaw().filter((e) => e.pid !== pid);
  writeRaw(all);
}
