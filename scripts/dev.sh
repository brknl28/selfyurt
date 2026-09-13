#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export AGENT_MODE="${AGENT_MODE:-mock}"
export AGENT_URL="${AGENT_URL:-http://127.0.0.1:7070}"
export AGENT_TOKEN="${AGENT_TOKEN:-dev-agent-token}"
export SESSION_SECRET="${SESSION_SECRET:-dev-session-secret-please-change}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme123}"
export DATABASE_URL="${DATABASE_URL:-file:./dev-selfyurt.db}"
export CATALOG_DIR="${CATALOG_DIR:-${ROOT_DIR}/apps/catalog}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export MOCK_AGENT_STATE_FILE="${MOCK_AGENT_STATE_FILE:-/tmp/selfyurt-mock-agent.json}"

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "${WEB_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

bun run --cwd "${ROOT_DIR}/packages/api" dev &
API_PID=$!

bun run --cwd "${ROOT_DIR}/packages/web" dev &
WEB_PID=$!

wait -n "$API_PID" "$WEB_PID"
