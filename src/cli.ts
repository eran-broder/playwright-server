#!/usr/bin/env node
import { parseArgs } from 'node:util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { values } = parseArgs({
  options: {
    port: { type: 'string' },
    dir: { type: 'string' },
    ephemeral: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (values.help) {
  console.log(`Usage: playwright-http-server [options]

Options:
  --port <n>     Port to listen on. Use 0 to let the OS pick a free port.
                 (default: 3456, or env PORT)
  --dir <path>   Working directory for screenshots/, scripts/, auth.json.
                 (default: current directory)
  --ephemeral    Spawn an isolated session: fresh tempdir + auto-picked port.
                 Prints both on startup.
  -h, --help     Show this help.

Examples:
  playwright-http-server
  playwright-http-server --port 3457 --dir ./sessionB
  playwright-http-server --ephemeral`);
  process.exit(0);
}

let workdir = values.dir;
let port = values.port;

if (values.ephemeral) {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-http-'));
  port = '0';
  console.log(`[ephemeral] workdir: ${workdir}`);
}

if (workdir) {
  fs.mkdirSync(workdir, { recursive: true });
  process.chdir(workdir);
}
if (port !== undefined) {
  process.env.PORT = port;
}

import './server';
