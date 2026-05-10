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
| [40-playwright-script.sh](40-playwright-script.sh) | `/script/execute-playwright` patterns — the escape hatch for full Playwright API access (page, context, browser). |
| [50-sdk.ts](50-sdk.ts) (run via [50-sdk.sh](50-sdk.sh)) | TypeScript SDK: `import { startServer } from 'playwright-http-server'` → typed methods with zod-validated responses, no curl needed. |

## Reading the tests

- Multi-line JavaScript is passed via heredocs (`<<'EOF'`) so bash doesn't mangle quotes/backticks.
- Every test uses `set -euo pipefail`; if any step fails the script aborts and the trap kills the spawned server.
- Output is shown raw (no jq/python parsing) so you see exactly what the API returns.
