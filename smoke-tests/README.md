# Smoke tests

Self-contained, runnable scripts that double as the **single source of truth** for how to use this package. Each script spawns its own server, walks through a focused set of API calls, and cleans up — so you can read it as documentation and run it as a check.

Run from the repo root after `npm install && npm run build`:

```bash
bash smoke-tests/run-all.sh        # everything in sequence
bash smoke-tests/00-quickstart.sh  # a single test
```

Each script auto-detects the local build via `node $SCRIPT_DIR/../dist/...`. To override (e.g. test a globally installed copy), set `PWHS=pwhs` or `SERVER=playwright-http-server` in the env.

## The tests

| Test | What it covers |
|------|----------------|
| [00-quickstart.sh](00-quickstart.sh) | Minimum viable end-to-end via `pwhs`: up, navigate, snapshot, eval, screenshot, activity poll, down. **Read this first.** |
| [10-curl.sh](10-curl.sh) | Same flow as 00 but using bare `curl` against the HTTP API — useful as an HTTP-only reference. |
| [20-multi-session.sh](20-multi-session.sh) | Three concurrent servers, port selection via `-p` and `$PWHS_PORT`, the no-default error path, `pwhs ls`, `down --all`. |
| [30-edge-profile.sh](30-edge-profile.sh) | `--browser edge --profile Default`: launches your installed Edge with a snapshot of your real profile (cookies, bookmarks, extensions). Close Edge first for full state transfer. |
| [35-attach.sh](35-attach.sh) | `--attach <port\|url\|auto>`: connect to an already-running browser over CDP — its tabs, cookies, and logins included. `/browser/stop` disconnects without killing it. |
| [40-playwright-script.sh](40-playwright-script.sh) | `/script/execute-playwright` patterns — the escape hatch for full Playwright API access (page, context, browser). |
| [45-ai-snapshot.sh](45-ai-snapshot.sh) | `pwhs snap --ai`: snapshot with `[ref=eN]` element refs, then act on what you saw via `pwhs click "aria-ref=eN"`. Plus `back`/`forward`/`reload` and download capture in the activity log. |
| [50-sdk.ts](50-sdk.ts) (run via [50-sdk.sh](50-sdk.sh)) | TypeScript SDK: `import { startServer } from 'playwright-http-server'` → typed methods with zod-validated responses, no curl needed. |
| [55-native-extras.sh](55-native-extras.sh) | Raw CDP passthrough (`pwhs cdp <method> [json]`), Playwright tracing (`pwhs trace start/stop` → trace.zip for the trace viewer), and clock control (`pwhs clock set/install/ff`). |
| [60-cli-contract.sh](60-cli-contract.sh) | Asserts the CLI contract: help text, error messages and exit codes, flag-anywhere parsing, every `pwhs` verb, multi-session ambiguity. |
| [65-viewport-window.sh](65-viewport-window.sh) | `--viewport window`: the page follows the OS window, so resizing crosses media-query breakpoints and fires resize events (proven against [responsive.html](responsive.html)); `emulated` (default) pins 1280x720 regardless of window size; device + `viewport=window` is rejected. |
| [75-extension.sh](75-extension.sh) | `--extension`: drive a normal browser through the **pwhs bridge** extension. Launches a host Chromium with the unpacked extension (via [_host-browser.ts](_host-browser.ts)), mints a pair code inside it, exercises `pwhs keys add/ls/rm` and the fast rejection of expired or malformed codes, starts with `pwhs up --extension --pair <code>`, then proves every verb through the bridge: profiles catalog, nav, ai refs, screenshots, activity, new tabs + `pages`/`switch`/`latest`, raw CDP incl. `Browser.*` translation, tracing, clock, downloads, `restart tab=N`, and that `stop` leaves the browser open. |
| [70-agent-repl.sh](70-agent-repl.sh) | Drive the SDK from a stateful Node REPL ([agent-repl](https://github.com/eran-broder/agent-repl)). One `globalThis.s = await startServer()`, then many independent `nrepl exec` calls share the same browser. Skipped automatically when `nrepl` is not on PATH (override with `NREPL="node /path/to/agent-repl/node/src/cli.js"`). |

## Reading the tests

Each test file is pure behaviour — no setup boilerplate, no helper definitions, no narrative comments. Setup, assertions, and lifecycle live in [`_helpers.sh`](_helpers.sh) (sourced by every bash test) and [`_helpers.ts`](_helpers.ts) (imported by `50-sdk.ts`).

- `start_session [server-flags...]` — spawn a server via `pwhs up`, set the cleanup trap, export `$PWHS_PORT`. Sets the global `PORT` for inspection. Forwards any args to the server (e.g. `start_session --browser edge --profile Default`).
- `start_session_via_server_log` — same outcome but spawns `playwright-http-server` directly and parses the port from the startup log. Used by `10-curl.sh` to demonstrate the no-pwhs path.
- `cleanup_all_sessions` — wired into the EXIT trap by `start_session`.
- `pwhs_play_heredoc` — feeds a heredoc to `pwhs play`, so multi-line JS doesn't fight bash quoting.
- `assert_contains` / `assert_fails_with` / `assert_ok` — used by `60-cli-contract.sh`. Each updates `assert_pass` / `assert_fail` counters; call `print_summary_and_exit` at the end.
- `start_host_browser [--extension] [--label L] [--mint <ttl>] [--debug-port N] [--url U]` — launches a host Chromium via [_host-browser.ts](_host-browser.ts) (with the unpacked extension, minting a pair code printed as `PAIR_CODE=` when `--mint` is given, or a remote-debugging port), waits for READY, and traps EXIT to kill the whole browser tree. Exposes `$HOST_LOG` and `$HOST_PID`.
- `kill_tree pid` — kills a process and its children (taskkill on Windows).
- `section "title"` — prints a labelled heading.
- Multi-line JavaScript is passed via heredocs (`<<'EOF'`) so bash doesn't mangle quotes/backticks.
- Output is shown raw (no jq/python parsing) so you see exactly what the API returns.
