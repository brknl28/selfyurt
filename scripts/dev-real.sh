#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v go >/dev/null 2>&1; then
  echo "Go is required for scripts/dev-real.sh"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for scripts/dev-real.sh"
  exit 1
fi

mkdir -p "${ROOT_DIR}/.runtime/selfyurt"
mkdir -p "${ROOT_DIR}/deploy/caddy/generated"

export AGENT_MODE="real"
export AGENT_URL="http://127.0.0.1:7070"
export AGENT_TOKEN="${AGENT_TOKEN:-dev-agent-token}"
export SESSION_SECRET="${SESSION_SECRET:-dev-session-secret-please-change}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme123}"
export DATABASE_URL="${DATABASE_URL:-file:./dev-selfyurt.db}"
export CATALOG_DIR="${CATALOG_DIR:-${ROOT_DIR}/apps/catalog}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"

cleanup() {
  if [[ -n "${AGENT_PID:-}" ]]; then
    kill "${AGENT_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "${WEB_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

(
  cd "${ROOT_DIR}/packages/agent"
  PORT=7070 \
  AGENT_TOKEN="${AGENT_TOKEN}" \
  CATALOG_DIR="${ROOT_DIR}/apps/catalog" \
  RUNTIME_DIR="${ROOT_DIR}/.runtime/selfyurt" \
  CADDY_SNIPPETS_DIR="${ROOT_DIR}/deploy/caddy/generated" \
  CADDY_CONTAINER_NAME="${CADDY_CONTAINER_NAME:-selfyurt_caddy}" \
  CADDY_RELOAD_DISABLED="${CADDY_RELOAD_DISABLED:-true}" \
  DOCKER_NETWORK_NAME="${DOCKER_NETWORK_NAME:-selfyurt_net}" \
  go run ./cmd/agent
) &
AGENT_PID=$!

bun run --cwd "${ROOT_DIR}/packages/api" dev &
API_PID=$!

bun run --cwd "${ROOT_DIR}/packages/web" dev &
WEB_PID=$!

wait -n "$AGENT_PID" "$API_PID" "$WEB_PID"
