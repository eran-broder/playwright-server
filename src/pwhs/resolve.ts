import * as path from 'path';
import { list as listSessions, SessionEntry } from '../session-registry';

export const extractPort = (args: string[]): { port?: number; args: string[] } => {
  const out: string[] = [];
  let port: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-p' || a === '--port') {
      port = Number(args[++i]);
    } else if (a.startsWith('--port=')) {
      port = Number(a.slice('--port='.length));
    } else {
      out.push(a);
    }
  }
  return { port, args: out };
};

const validPort = (p: number | undefined): number | undefined =>
  p !== undefined && !Number.isNaN(p) ? p : undefined;

const envPort = (): number | undefined => {
  const raw = process.env.PWHS_PORT;
  return raw === undefined ? undefined : validPort(Number(raw));
};

const normalize = (p: string): string => {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const isSelfOrAncestor = (ancestor: string, dir: string): boolean =>
  dir === ancestor || dir.startsWith(ancestor.endsWith(path.sep) ? ancestor : ancestor + path.sep);

type LaunchedSession = SessionEntry & { launchCwd: string };

const isLaunched = (s: SessionEntry): s is LaunchedSession => s.launchCwd !== undefined;

const matchByCwd = (sessions: SessionEntry[]): SessionEntry[] => {
  const cwd = normalize(process.cwd());
  const candidates = sessions
    .filter(isLaunched)
    .map((session) => ({ session, launchDir: normalize(session.launchCwd) }))
    .filter(({ launchDir }) => isSelfOrAncestor(launchDir, cwd));
  const nearest = Math.max(0, ...candidates.map(({ launchDir }) => launchDir.length));
  return candidates
    .filter(({ launchDir }) => launchDir.length === nearest)
    .map(({ session }) => session);
};

const optionLines = (sessions: SessionEntry[]): string =>
  sessions.map((s) => `  -p ${s.port}    ${s.launchCwd ?? s.workdir}`).join('\n');

const sameDirError = (matched: SessionEntry[]): Error =>
  new Error(`Multiple servers launched from this directory. Pass -p <port>:\n${optionLines(matched)}`);

const noMatchError = (sessions: SessionEntry[]): Error => {
  const intro =
    sessions.length === 1
      ? "No server matches this directory. Set $PWHS_PORT, pass -p <port>, or run from a server's launch directory:"
      : 'Multiple servers running, none launched from this directory. Set $PWHS_PORT or pass -p <port>:';
  return new Error(`${intro}\n${optionLines(sessions)}`);
};

export const resolvePort = (flagPort: number | undefined): number => {
  const explicit = validPort(flagPort) ?? envPort();
  if (explicit !== undefined) return explicit;
  const sessions = listSessions();
  if (sessions.length === 0) throw new Error('No servers running. Start one with: pwhs up');
  const matched = matchByCwd(sessions);
  if (matched.length === 1) return matched[0].port;
  throw matched.length > 1 ? sameDirError(matched) : noMatchError(sessions);
};
