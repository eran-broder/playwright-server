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
playwright-http-server --extension --profile Work               # drive your normal browser via the pwhs bridge extension
playwright-http-server --port 3456 --dir ./mySession            # pinned port + workdir
```

`--attach` connects over CDP to a running Chrome/Edge — tabs, cookies, and logins included — instead of launching a new browser. Enable remote debugging once (`chrome://inspect/#remote-debugging` on Chrome 146+, or launch with `--remote-debugging-port=9222`), then attach by port, URL, or `auto`. Stopping the server disconnects; your browser stays open.

Every invocation is fully isolated: a fresh tempdir for screenshots/scripts and an OS-picked free port. Both are printed on startup. Run as many concurrent instances as you want.

## Drive your normal browser (extension mode)

Some sites block browsers that were launched by automation. Extension mode sidesteps that: the **pwhs bridge** extension runs inside your everyday Chrome or Edge profile and bridges the DevTools protocol to the server over a token-protected local relay. No launch flags, no debug port, real cookies and logins. The whole HTTP API, `pwhs` and the SDK work unchanged.

```bash
# 1. Load the extension once per browser profile you want to drive:
#    chrome://extensions -> Developer mode -> Load unpacked -> <package>/extension
# 2. Pair it hands-free: opens a local page in your default browser, the extension picks up
#    the token, and the command confirms. Paste the printed URL into any other profile too.
pwhs pair --label Work            # (manual alternative: pwhs token, then paste into the popup)

# 3. Drive it. --profile picks the label you chose; omit it when only one profile is paired.
pwhs up --extension --profile Work
pwhs profiles                     # every paired profile with its windows and tabs
pwhs nav https://example.com      # ... every other verb as usual
pwhs restart tab=1234             # hook onto an already-open tab (ids from `pwhs profiles` / `pwhs pages`)
pwhs stop                         # detaches; your browser stays open
```

`--window <id>` adopts a window's active tab, `--tab <id>` adopts exactly that tab; the default is the active tab of the focused window. `pwhs pages` lists every tab in the profile with ids, `pwhs switch <index>` attaches on demand, and tabs opened by the page are followed automatically. Only the tabs you drive show Chrome's "is debugging this browser" bar.

What changes in this mode: the viewport follows the OS window by default (`viewport=emulated` pins 1280x720 per tab), device emulation is unavailable, `chrome://` pages and the Web Store cannot be attached, and top-level `data:` URLs are served through the relay because Chrome refuses them from the debugger API. Everything else, including AI snapshots with refs, tracing, clock control, raw CDP (with `Browser.*` window calls translated) and download capture, goes through the same code path as the other modes.

Pairing is one token per machine (stored in the pwhs config dir), done once per profile with `pwhs pair`. The relay only accepts sockets from a `chrome-extension://` origin and both sides prove the token with an HMAC challenge before any traffic flows.

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
| [smoke-tests/75-extension.sh](smoke-tests/75-extension.sh) | Drive a normal browser through the pwhs bridge extension (`--extension`), pick profiles, windows and tabs |

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
