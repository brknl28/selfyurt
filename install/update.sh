#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/selfyurt"

if [[ ! -d "${INSTALL_DIR}/.git" ]]; then
  echo "SelfYurt repository not found at ${INSTALL_DIR}"
  exit 1
fi

cd "${INSTALL_DIR}"
git pull --ff-only
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

echo "SelfYurt updated."
