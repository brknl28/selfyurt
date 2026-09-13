#!/usr/bin/env bash
set -euo pipefail

bun run --cwd packages/api build
bun run --cwd packages/web build

if command -v go >/dev/null 2>&1; then
  (cd packages/agent && go build ./cmd/agent)
else
  echo "Go is not installed; skipping agent build."
fi

echo "Build finished."
