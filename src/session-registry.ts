import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { configDir } from './config-dir';

const SessionEntrySchema = z.object({
  port: z.number(),
  workdir: z.string(),
  launchCwd: z.string().optional(),
  pid: z.number(),
  startedAt: z.number(),
});

const SessionsFileSchema = z.array(SessionEntrySchema);

export type SessionEntry = z.infer<typeof SessionEntrySchema>;

const sessionsFile = (): string => path.join(configDir(), 'sessions.json');

const readRaw = (): SessionEntry[] => {
  const f = sessionsFile();
  if (!fs.existsSync(f)) return [];
  try {
    const parsed = SessionsFileSchema.safeParse(JSON.parse(fs.readFileSync(f, 'utf-8')));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

const writeRaw = (entries: SessionEntry[]): void => {
  const f = sessionsFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(entries, null, 2));
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const list = (): SessionEntry[] => {
  const all = readRaw();
  const alive = all.filter((e) => isAlive(e.pid));
  if (alive.length !== all.length) writeRaw(alive);
  return alive;
};

export const register = (entry: SessionEntry): void => {
  const validated = SessionEntrySchema.parse(entry);
  const all = readRaw().filter((e) => e.pid !== validated.pid && e.port !== validated.port);
  all.push(validated);
  writeRaw(all);
};

export const unregister = (pid: number): void => {
  writeRaw(readRaw().filter((e) => e.pid !== pid));
};
