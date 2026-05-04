#!/usr/bin/env node
import { parseArgs } from 'node:util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { values } = parseArgs({
  options: {
    port: { type: 'string' },
    dir: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (values.help) {
  console.log(`Usage: playwright-http-server [options]

Every invocation spawns a fresh isolated session: a new tempdir for
screenshots/scripts/auth, and an OS-picked free port. Both are printed
on startup. Run it as many times as you want — sessions never interfere.

Options:
  --port <n>     Override the auto-picked port. Use 0 to keep auto-pick.
  --dir <path>   Override the auto-created tempdir.
  -h, --help     Show this help.

Examples:
  playwright-http-server                       # fresh port + tempdir
  playwright-http-server --port 3456           # fixed port, fresh tempdir
  playwright-http-server --dir ./mySession     # fixed dir, fresh port`);
  process.exit(0);
}

const workdir = values.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-http-'));
const port = values.port ?? '0';

fs.mkdirSync(workdir, { recursive: true });
process.chdir(workdir);
process.env.PORT = port;

console.log(`[session] workdir: ${workdir}`);

import './server';
