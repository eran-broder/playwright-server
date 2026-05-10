#!/usr/bin/env bash
# 50-sdk.sh — runs the TypeScript SDK smoke test (50-sdk.ts) via ts-node.
# Demonstrates `import { startServer } from 'playwright-http-server'` —
# typed methods, zod-validated responses, no curl boilerplate.
#
# Run from repo root:  bash smoke-tests/50-sdk.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec npx --no-install ts-node "$SCRIPT_DIR/50-sdk.ts"
