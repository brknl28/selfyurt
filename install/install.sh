#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SELFYURT_REPO_URL:-https://github.com/selfyurt/selfyurt.git}"
INSTALL_DIR="/opt/selfyurt"
ENV_FILE="${INSTALL_DIR}/deploy/.env"

log() {
  printf "[selfyurt-install] %s\n" "$*"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    log "Please run as root (sudo)."
    exit 1
  fi
}

check_ubuntu_version() {
  if [[ ! -f /etc/os-release ]]; then
    log "Cannot detect OS. /etc/os-release missing."
    exit 1
  fi

  # shellcheck source=/dev/null
  . /etc/os-release

  if [[ "${ID:-}" != "ubuntu" ]]; then
    log "SelfYurt installer supports Ubuntu 22.04+ only."
    exit 1
  fi

  local version
  version="${VERSION_ID:-0}"
  if ! dpkg --compare-versions "${version}" ge "22.04"; then
    log "Ubuntu ${version} detected. Ubuntu 22.04+ is required."
    exit 1
  fi
}

install_base_packages() {
  log "Installing base packages..."
  apt-get update -y
  apt-get install -y curl git ca-certificates gnupg lsb-release
}

install_docker_if_missing() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed."
  else
    log "Installing Docker Engine + Compose plugin..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" | \
      tee /etc/apt/sources.list.d/docker.list >/dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  systemctl enable docker
  systemctl restart docker
}

ensure_repo() {
  mkdir -p "${INSTALL_DIR}"

  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    log "Existing repository found, pulling latest..."
    git -C "${INSTALL_DIR}" pull --ff-only
  else
    log "Cloning repository into ${INSTALL_DIR}..."
    rm -rf "${INSTALL_DIR}"
    git clone "${REPO_URL}" "${INSTALL_DIR}"
  fi
}

random_secret() {
  openssl rand -hex 32
}

random_password() {
  openssl rand -base64 18 | tr -d '=+/' | cut -c1-20
}

write_env_file() {
  local agent_token admin_email admin_password session_secret
  agent_token="$(random_secret)"
  admin_email="${SELFYURT_ADMIN_EMAIL:-admin@example.com}"
  admin_password="$(random_password)"
  session_secret="$(random_secret)"

  cat >"${ENV_FILE}" <<ENVEOF
SELFYURT_AGENT_TOKEN=${agent_token}
SELFYURT_AGENT_MODE=real
SELFYURT_ADMIN_EMAIL=${admin_email}
SELFYURT_ADMIN_PASSWORD=${admin_password}
SELFYURT_SESSION_SECRET=${session_secret}
SELFYURT_BASE_DOMAIN=
SELFYURT_PANEL_HOST=localhost
SELFYURT_LETSENCRYPT_EMAIL=
SELFYURT_COOKIE_SECURE=false
ENVEOF

  chmod 600 "${ENV_FILE}"

  VPS_IP="$(hostname -I | awk '{print $1}')"

  log "Installation environment created."
  echo
  echo "SelfYurt is starting..."
  echo "Panel URL (initial HTTP): http://${VPS_IP}"
  echo "Admin Email: ${admin_email}"
  echo "Admin Password: ${admin_password}"
  echo
  echo "Next steps:"
  echo "1) Open panel via IP and login"
  echo "2) Set DNS A record panel.<domain> -> ${VPS_IP}"
  echo "3) Set app subdomain A records -> ${VPS_IP}"
}

start_stack() {
  log "Starting Docker Compose stack..."
  cd "${INSTALL_DIR}"
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
}

main() {
  require_root
  check_ubuntu_version
  install_base_packages
  install_docker_if_missing
  ensure_repo
  write_env_file
  start_stack
  log "Done."
}

main "$@"
