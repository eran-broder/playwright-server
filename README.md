# playwright-http-server

A local HTTP server that exposes Playwright browser automation as a REST API. Drive a real Chromium / Edge / Chrome browser via simple HTTP calls.

## Install

```bash
npm install -g playwright-http-server
npx playwright install chromium    # one-time, if you want the default engine
```

Three ways to drive it:

- `playwright-http-server` — the server itself, drive via HTTP / curl
- `pwhs` — a terse CLI for driving running servers (`pwhs up`, `pwhs nav`, `pwhs click`, ...)
- `import { startServer } from 'playwright-http-server'` — TypeScript SDK with typed, zod-validated methods

## Run

```bash
playwright-http-server                                          # ephemeral chromium
playwright-http-server --browser edge --profile Default         # your real Edge profile
playwright-http-server --attach auto                            # attach to a browser you already have open
playwright-http-server --port 3456 --dir ./mySession            # pinned port + workdir
```

`--attach` connects over CDP to a running Chrome/Edge — tabs, cookies, and logins included — instead of launching a new browser. Enable remote debugging once (`chrome://inspect/#remote-debugging` on Chrome 146+, or launch with `--remote-debugging-port=9222`), then attach by port, URL, or `auto`. Stopping the server disconnects; your browser stays open.

Every invocation is fully isolated: a fresh tempdir for screenshots/scripts and an OS-picked free port. Both are printed on startup. Run as many concurrent instances as you want.

`playwright-http-server --help` lists every flag.

## Usage

The **single source of truth** for what this package does is the runnable smoke tests in [`smoke-tests/`](smoke-tests/). Each one is short, self-contained, and doubles as documentation:

| Read this first | If you want to … |
|---|---|
| [smoke-tests/00-quickstart.sh](smoke-tests/00-quickstart.sh) | See the minimum viable end-to-end flow (the `pwhs` CLI) |
| [smoke-tests/10-curl.sh](smoke-tests/10-curl.sh) | Use the raw HTTP API with curl |
| [smoke-tests/20-multi-session.sh](smoke-tests/20-multi-session.sh) | Run multiple concurrent servers and pick which one each call hits |
| [smoke-tests/30-edge-profile.sh](smoke-tests/30-edge-profile.sh) | Launch your installed Edge with your real Default profile |
| [smoke-tests/35-attach.sh](smoke-tests/35-attach.sh) | Attach to an already-running browser over CDP (`--attach`) |
| [smoke-tests/40-playwright-script.sh](smoke-tests/40-playwright-script.sh) | Use `/script/execute-playwright` for full Playwright API access |
| [smoke-tests/45-ai-snapshot.sh](smoke-tests/45-ai-snapshot.sh) | Take AI snapshots with `[ref=eN]` and click via `aria-ref=eN` — no selector guessing |
| [smoke-tests/50-sdk.ts](smoke-tests/50-sdk.ts) | Use the TypeScript SDK — typed methods, no curl |
| [smoke-tests/55-native-extras.sh](smoke-tests/55-native-extras.sh) | Raw CDP commands, Playwright tracing, clock control |
| [smoke-tests/70-agent-repl.sh](smoke-tests/70-agent-repl.sh) | Drive the SDK from a stateful Node REPL — share one browser across many turns |

```bash
bash smoke-tests/run-all.sh   # run every test
```

See [`smoke-tests/README.md`](smoke-tests/README.md) for the index.

## Use it from a stateful REPL

For agents that drive the browser over many turns, pair the SDK with a persistent Node REPL like [agent-repl](https://github.com/eran-broder/agent-repl) (ships an `nrepl` CLI). One bootstrap, then any number of subsequent calls share the same browser through the REPL's global object.

```bash
npm install -g github:eran-broder/agent-repl#main:/node   # ships `nrepl`

R=$(nrepl create)
nrepl exec $R "globalThis.sdk = require('playwright-http-server')"
nrepl exec $R "globalThis.s   = await sdk.startServer()"    # add { browser: 'edge', profile: 'Default' } to use your real profile,
                                                            # or { attach: 'auto' } to attach to a browser you already have open

# … then, in any number of independent exec calls (different shells, different sessions),
# the same `s` is reachable on globalThis and the same browser handles every request:

nrepl exec $R "await s.nav('https://example.com')"
nrepl exec $R "await s.title()"
nrepl exec $R "await s.eval('document.querySelectorAll(\"a\").length')"

# Multi-statement code with await works too — top-level declarations land on globalThis
# (see agent-repl's transform.js):
nrepl exec $R "for (const u of urls) { await s.nav(u); titles.push(await s.title()) }"
nrepl exec $R "titles"

# Teardown
nrepl exec $R "await s.close()"
nrepl destroy $R
```

Why this is useful: the REPL's process keeps `s` alive between calls, and `s.spawnedPid` (the browser process) stays the same — so cookies, navigation history, open tabs, and the activity log accumulate across turns instead of resetting per call. [`smoke-tests/70-agent-repl.sh`](smoke-tests/70-agent-repl.sh) is the runnable proof.

## License

MIT
