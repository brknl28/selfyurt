#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/selfyurt"
REMOVE_VOLUMES="${1:-}"

if [[ ! -d "${INSTALL_DIR}" ]]; then
  echo "SelfYurt is not installed at ${INSTALL_DIR}"
  exit 0
fi

cd "${INSTALL_DIR}"

if [[ "${REMOVE_VOLUMES}" == "--volumes" ]]; then
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env down --volumes --remove-orphans
else
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env down --remove-orphans
fi

echo "SelfYurt stack stopped."
