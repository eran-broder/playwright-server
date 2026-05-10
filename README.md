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
playwright-http-server --port 3456 --dir ./mySession            # pinned port + workdir
```

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
| [smoke-tests/40-playwright-script.sh](smoke-tests/40-playwright-script.sh) | Use `/script/execute-playwright` for full Playwright API access |
| [smoke-tests/50-sdk.ts](smoke-tests/50-sdk.ts) | Use the TypeScript SDK — typed methods, no curl |

```bash
bash smoke-tests/run-all.sh   # run every test
```

See [`smoke-tests/README.md`](smoke-tests/README.md) for the index.

## License

MIT
