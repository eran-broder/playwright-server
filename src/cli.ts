#!/usr/bin/env node
import { parseArgs } from 'node:util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mirrorConsoleToFile } from './log-file';

const { values } = parseArgs({
  options: {
    port: { type: 'string' },
    dir: { type: 'string' },
    browser: { type: 'string' },
    profile: { type: 'string' },
    'profile-mode': { type: 'string' },
    'user-data-dir': { type: 'string' },
    attach: { type: 'string' },
    extension: { type: 'boolean' },
    window: { type: 'string' },
    tab: { type: 'string' },
    viewport: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

const HELP = `Usage: playwright-http-server [options]

Every invocation spawns a fresh isolated session: a new tempdir for
screenshots/scripts/auth, and an OS-picked free port. Both are printed
on startup. Run it as many times as you want — sessions never interfere.

Options:
  --port <n>                 Override the auto-picked port. Use 0 for auto-pick.
  --dir <path>               Override the auto-created tempdir.
  --browser <kind>           chromium (default) | edge | chrome
  --profile <name>           Launch mode: profile directory (Default, "Profile 1").
                             Extension mode: label of the paired browser profile.
  --profile-mode <mode>      copy (default, snapshot to tempdir) | live (real path).
  --user-data-dir <path>     Override the auto-detected user-data-dir.
  --attach <target>          Attach to a running browser over CDP instead of
                             launching one. Target: port, URL, or "auto"
                             (DevToolsActivePort of Chrome/Edge, then :9222).
  --extension                Drive a normal browser through the pwhs bridge
                             extension. No launch flags, no debug port, real
                             profile. Pair once with the token from 'pwhs token'.
  --window <id>              Extension mode: adopt this window's active tab.
  --tab <id>                 Extension mode: adopt exactly this tab.
  --viewport <mode>          emulated: fixed 1280x720 viewport (default when
                             launching). window: viewport follows the OS window
                             (default in extension mode).
  -h, --help                 Show this help.

Examples:
  playwright-http-server
  playwright-http-server --browser edge --profile Default
  playwright-http-server --browser chrome --profile "Profile 1" --profile-mode live
  playwright-http-server --user-data-dir ./my-profile
  playwright-http-server --attach auto
  playwright-http-server --extension --profile Work
  playwright-http-server --extension --tab 1234

Notes:
  - --profile-mode copy snapshots the profile (excluding cache dirs) so the
    real browser profile is never modified. Close the source browser first
    so cookie/login SQLite files aren't locked during the copy.
  - --profile-mode live launches on the real path. Source browser must be
    fully closed; automation changes will persist back to your real profile.
  - --extension waits for a paired browser profile to connect; click the
    extension icon to connect immediately.`;

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const LAUNCH_ONLY_FLAGS = ['browser', 'profile-mode', 'user-data-dir', 'attach'] as const;
const EXTENSION_ONLY_FLAGS = ['window', 'tab'] as const;

const rejectConflicts = (): void => {
  if (values.extension) {
    const clash = LAUNCH_ONLY_FLAGS.filter((f) => values[f] !== undefined);
    if (clash.length > 0) throw new Error(`--extension cannot be combined with --${clash.join(', --')}`);
    return;
  }
  const clash = EXTENSION_ONLY_FLAGS.filter((f) => values[f] !== undefined);
  if (clash.length > 0) throw new Error(`--${clash.join(', --')} require --extension`);
};

rejectConflicts();

const workdir = values.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-http-'));
const port = values.port ?? '0';

if (!process.env.PWHS_LAUNCH_CWD) process.env.PWHS_LAUNCH_CWD = process.cwd();
fs.mkdirSync(workdir, { recursive: true });
process.chdir(workdir);
process.env.PORT = port;

const ENV_FROM_FLAG: Record<string, string | undefined> = {
  BROWSER: values.browser,
  PROFILE: values.profile,
  PROFILE_MODE: values['profile-mode'],
  USER_DATA_DIR: values['user-data-dir'],
  ATTACH: values.attach,
  EXTENSION: values.extension ? '1' : undefined,
  WINDOW: values.window,
  TAB: values.tab,
  VIEWPORT: values.viewport,
};
Object.entries(ENV_FROM_FLAG)
  .filter((entry): entry is [string, string] => entry[1] !== undefined)
  .forEach(([name, value]) => { process.env[name] = value; });

const logFile = mirrorConsoleToFile(workdir);
console.log(`[session] workdir: ${workdir}`);
console.log(`[session] log: ${logFile}`);

import './server';
