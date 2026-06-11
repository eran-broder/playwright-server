#!/usr/bin/env node
import { parseArgs } from 'node:util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { values } = parseArgs({
  options: {
    port: { type: 'string' },
    dir: { type: 'string' },
    browser: { type: 'string' },
    profile: { type: 'string' },
    'profile-mode': { type: 'string' },
    'user-data-dir': { type: 'string' },
    attach: { type: 'string' },
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
  --port <n>                 Override the auto-picked port. Use 0 for auto-pick.
  --dir <path>               Override the auto-created tempdir.
  --browser <kind>           chromium (default) | edge | chrome
  --profile <name>           Profile name (e.g. Default, "Profile 1").
                             Implies persistent-context mode.
  --profile-mode <mode>      copy (default, snapshot to tempdir) | live (real path).
  --user-data-dir <path>     Override the auto-detected user-data-dir.
  --attach <target>          Attach to a running browser over CDP instead of
                             launching one. Target: port, URL, or "auto"
                             (DevToolsActivePort of Chrome/Edge, then :9222).
  -h, --help                 Show this help.

Examples:
  playwright-http-server
  playwright-http-server --browser edge --profile Default
  playwright-http-server --browser chrome --profile "Profile 1" --profile-mode live
  playwright-http-server --user-data-dir ./my-profile
  playwright-http-server --attach auto
  playwright-http-server --attach 9222

Notes:
  - --profile-mode copy snapshots the profile (excluding cache dirs) so the
    real browser profile is never modified. Close the source browser first
    so cookie/login SQLite files aren't locked during the copy.
  - --profile-mode live launches on the real path. Source browser must be
    fully closed; automation changes will persist back to your real profile.`);
  process.exit(0);
}

const workdir = values.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-http-'));
const port = values.port ?? '0';

fs.mkdirSync(workdir, { recursive: true });
process.chdir(workdir);
process.env.PORT = port;

if (values.browser) process.env.BROWSER = values.browser;
if (values.profile) process.env.PROFILE = values.profile;
if (values['profile-mode']) process.env.PROFILE_MODE = values['profile-mode'];
if (values['user-data-dir']) process.env.USER_DATA_DIR = values['user-data-dir'];
if (values.attach) process.env.ATTACH = values.attach;

console.log(`[session] workdir: ${workdir}`);

import './server';
