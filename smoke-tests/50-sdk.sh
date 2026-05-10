#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec npx --no-install ts-node "$SCRIPT_DIR/50-sdk.ts"
