#!/usr/bin/env node
import { spawn } from 'child_process';
import * as path from 'path';
import { list as listSessions } from './session-registry';

const HELP = `Usage: pwhs <verb> [args] [-p <port>]

Lifecycle:
  pwhs up [server-flags]      Start a server, print its port to stdout
  pwhs down [-p <port>]       Stop the server on <port>
  pwhs down --all             Stop every running server
  pwhs ls                     List running servers (pruned to live pids)

Browser:
  pwhs status                 GET /status
  pwhs start [device]         POST /browser/start (optional device name)
  pwhs stop                   POST /browser/stop
  pwhs restart [device]       POST /browser/restart

Navigation:
  pwhs nav <url>              POST /navigate
  pwhs url                    GET /url
  pwhs title                  GET /title
  pwhs html                   GET /content
  pwhs snap [selector]        GET /snapshot

Interaction:
  pwhs click <selector>
  pwhs type <selector> <text>
  pwhs hover <selector>
  pwhs select <selector> <value>
  pwhs scroll [x] [y]
  pwhs key <key>
  pwhs wait <selector> [timeout-ms]

Capture:
  pwhs shot [name]            POST /screenshot, prints filepath
  pwhs shots                  GET /screenshots

Code execution:
  pwhs eval <js>              POST /execute/inline (page context)
  pwhs play <js>              POST /script/execute-playwright (Playwright API)

Activity:
  pwhs poll [since]
  pwhs check [since]

Multi-tab:
  pwhs pages
  pwhs switch <index>
  pwhs latest

Port selection (every verb except up/ls):
  --port <n> / -p <n>     Per-call override.
  $PWHS_PORT              Sticky session for the shell.
  Neither set, multiple servers running -> error showing the options.
  Neither set, no servers running       -> error suggesting 'pwhs up'.
`;

main().catch((err) => {
  process.stderr.write((err?.message ?? String(err)) + '\n');
  process.exit(1);
});

async function main() {
  const argv = process.argv.slice(2);
  const { port: flagPort, args: nonFlag } = extractPort(argv);
  const verb = nonFlag[0];
  const args = nonFlag.slice(1);

  if (!verb || verb === '-h' || verb === '--help') {
    process.stdout.write(HELP);
    return;
  }

  if (verb === 'up') return up(args);
  if (verb === 'ls') return ls();
  if (verb === 'down') return down(flagPort, args);

  const port = resolvePort(flagPort);
  return runVerb(verb, port, args);
}

function extractPort(args: string[]): { port?: number; args: string[] } {
  const out: string[] = [];
  let port: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-p' || a === '--port') {
      port = Number(args[++i]);
    } else if (a.startsWith('--port=')) {
      port = Number(a.slice(7));
    } else {
      out.push(a);
    }
  }
  return { port, args: out };
}

function resolvePort(flagPort: number | undefined): number {
  if (flagPort !== undefined && !Number.isNaN(flagPort)) return flagPort;
  if (process.env.PWHS_PORT) {
    const p = Number(process.env.PWHS_PORT);
    if (!Number.isNaN(p)) return p;
  }
  const sessions = listSessions();
  if (sessions.length === 0) {
    throw new Error('No servers running. Start one with: pwhs up');
  }
  const lines = sessions
    .map((s) => `  -p ${s.port}    ${s.workdir}`)
    .join('\n');
  const intro =
    sessions.length === 1
      ? 'No port specified. Set $PWHS_PORT or pass -p <port>:'
      : 'Multiple servers running. Set $PWHS_PORT or pass -p <port>:';
  throw new Error(`${intro}\n${lines}`);
}

async function up(serverFlags: string[]) {
  const cliPath = path.join(__dirname, 'cli.js');
  const child = spawn(process.execPath, [cliPath, ...serverFlags], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  const pid = child.pid;
  if (!pid) throw new Error('Failed to spawn server');

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const sessions = listSessions();
    const entry = sessions.find((s) => s.pid === pid);
    if (entry) {
      process.stdout.write(String(entry.port) + '\n');
      return;
    }
    await sleep(150);
  }
  throw new Error(`Server (pid ${pid}) did not register within 60s`);
}

function ls() {
  const sessions = listSessions();
  if (sessions.length === 0) {
    process.stderr.write('No servers running.\n');
    return;
  }
  const now = Date.now();
  const headers = ['PORT', 'AGE', 'PID', 'WORKDIR'];
  const rows = sessions.map((s) => [
    String(s.port),
    formatAge(now - s.startedAt),
    String(s.pid),
    s.workdir,
  ]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  process.stdout.write(fmt(headers) + '\n');
  for (const r of rows) process.stdout.write(fmt(r) + '\n');
}

async function down(flagPort: number | undefined, args: string[]) {
  if (args.includes('--all')) {
    const sessions = listSessions();
    let killed = 0;
    for (const s of sessions) {
      try {
        process.kill(s.pid, 'SIGTERM');
        killed++;
      } catch { /* already gone */ }
    }
    process.stdout.write(`Killed ${killed} server(s).\n`);
    return;
  }
  const port = resolvePort(flagPort);
  const target = listSessions().find((s) => s.port === port);
  if (!target) throw new Error(`No server registered on port ${port}`);
  process.kill(target.pid, 'SIGTERM');
  process.stdout.write(`Killed pid ${target.pid} on port ${port}.\n`);
}

async function runVerb(v: string, port: number, args: string[]) {
  const need = (n: number, names: string[]) => {
    if (args.length < n) throw new Error(`${v} expects: ${names.join(' ')}`);
  };

  switch (v) {
    case 'status':
      return print(await getJson(port, '/status'));

    case 'start':
      return print(await postJson(port, '/browser/start', args[0] ? { device: args[0] } : {}));
    case 'stop':
      return print(await postJson(port, '/browser/stop'));
    case 'restart':
      return print(await postJson(port, '/browser/restart', args[0] ? { device: args[0] } : {}));

    case 'nav':
      need(1, ['<url>']);
      return print(await postJson(port, '/navigate', { url: args[0] }));
    case 'url':
      return print((await getJson(port, '/url')).url);
    case 'title':
      return print((await getJson(port, '/title')).title);
    case 'html':
      return print((await getJson(port, '/content')).content);
    case 'snap': {
      const q = args[0] ? `?selector=${encodeURIComponent(args[0])}` : '';
      return print((await getJson(port, `/snapshot${q}`)).snapshot);
    }

    case 'click':
      need(1, ['<selector>']);
      return print(await postJson(port, '/click', { selector: args[0] }));
    case 'type':
      need(2, ['<selector>', '<text>']);
      return print(await postJson(port, '/type', { selector: args[0], text: args[1] }));
    case 'hover':
      need(1, ['<selector>']);
      return print(await postJson(port, '/hover', { selector: args[0] }));
    case 'select':
      need(2, ['<selector>', '<value>']);
      return print(await postJson(port, '/select', { selector: args[0], value: args[1] }));
    case 'scroll':
      return print(await postJson(port, '/scroll', { x: Number(args[0] ?? 0), y: Number(args[1] ?? 0) }));
    case 'key':
      need(1, ['<key>']);
      return print(await postJson(port, '/keyboard', { key: args[0] }));
    case 'wait':
      need(1, ['<selector>', '[timeout-ms]']);
      return print(await postJson(port, '/wait', {
        selector: args[0],
        ...(args[1] ? { timeout: Number(args[1]) } : {}),
      }));

    case 'shot': {
      const r = await postJson(port, '/screenshot', args[0] ? { name: args[0] } : {});
      return print(r.path ?? r);
    }
    case 'shots':
      return print((await getJson(port, '/screenshots')).screenshots);

    case 'eval':
      need(1, ['<js>']);
      return print((await postJson(port, '/execute/inline', { code: args[0] })).result);
    case 'play':
      need(1, ['<js>']);
      return print((await postJson(port, '/script/execute-playwright', { code: args[0] })).result);

    case 'poll':
      return print(await getJson(port, `/activity/poll?since=${Number(args[0] ?? 0)}`));
    case 'check':
      return print(await getJson(port, `/activity/check?since=${Number(args[0] ?? 0)}`));

    case 'pages':
      return print((await getJson(port, '/pages')).pages);
    case 'switch':
      need(1, ['<index>']);
      return print(await postJson(port, '/pages/switch', { index: Number(args[0]) }));
    case 'latest':
      return print(await postJson(port, '/pages/switch-latest'));

    default:
      throw new Error(`Unknown verb: ${v}\n\n${HELP}`);
  }
}

function print(v: unknown) {
  if (v == null) return;
  if (typeof v === 'string') {
    process.stdout.write(v.endsWith('\n') ? v : v + '\n');
  } else if (typeof v === 'number' || typeof v === 'boolean') {
    process.stdout.write(String(v) + '\n');
  } else {
    process.stdout.write(JSON.stringify(v, null, 2) + '\n');
  }
}

async function getJson(port: number, p: string): Promise<any> {
  const r = await fetch(`http://localhost:${port}${p}`);
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${p}: ${text}`);
  return JSON.parse(text);
}

async function postJson(port: number, p: string, body?: unknown): Promise<any> {
  const r = await fetch(`http://localhost:${port}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${p}: ${text}`);
  return JSON.parse(text);
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

