<div align="center">
  <h1>SelfYurt</h1>
  <p><em>Open-source self-hosting control plane for a single Ubuntu VPS</em></p>
  
  <p>
    <img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=for-the-badge&logo=go" alt="Go" />
    <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker" alt="Docker Compose" />
    <img src="https://img.shields.io/badge/Caddy-2.8-1F88C0?style=for-the-badge&logo=caddy" alt="Caddy" />
    <img src="https://img.shields.io/badge/Fastify-5.2-000000?style=for-the-badge&logo=fastify" alt="Fastify" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite" alt="SQLite" />
    <img src="https://img.shields.io/badge/Vite-6.1-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
  </p>
</div>

SelfYurt is an open-source self-hosting control plane for a single Ubuntu VPS.
You install it on your own server, connect your own domain, then deploy apps from a web panel to subdomains with automatic HTTPS.

## MVP Scope

- Single admin user
- App Gallery driven by YAML manifests
- Deploy apps to subdomains
- Caddy reverse proxy + automatic TLS in production
- Local-first development flow (HTTP)
- Docker Compose runtime (no Kubernetes)

## Stack

- Web: Vite + React + TypeScript + TanStack Router + TanStack Query + Tailwind + shadcn/ui
- API: Fastify + TypeScript + Prisma + SQLite
- Agent: Go (internal-only) + Docker CLI orchestration
- Proxy: Caddy
- Runtime: Docker Engine + Docker Compose plugin

## Repository Layout

```text
selfyurt/
  docs/
  install/
  deploy/
  apps/
  packages/
    web/
    api/
    agent/
  scripts/
```

## Local Development

### Requirements

- Bun 1.3+
- Docker + Docker Compose plugin (only for real deploy flow)
- Go 1.22+ (only for real deploy flow)

Install workspace dependencies:

```bash
bun install
```

### Mock local (recommended default)

Runs web + api with `AGENT_MODE=mock`, so login, metrics, deploy/list/logs/start/stop/update/uninstall flows work without Docker/Go.

```bash
./scripts/dev.sh
```

Panel URL:
- [http://localhost:5173](http://localhost:5173)

Default local admin:
- `admin@example.com`
- `changeme123`

### Real local (Docker + Go required)

Runs local go-agent + api + web. Deployments execute real `docker compose` lifecycle.

```bash
./scripts/dev-real.sh
```

Panel URL:
- [http://localhost:5173](http://localhost:5173)

### Full Docker stack (production-like local)

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Panel URLs:
- [http://localhost](http://localhost)
- [http://127.0.0.1.nip.io](http://127.0.0.1.nip.io)

## App Support (current MVP)

- `nginx-hello`: public HTTP exposure supported.
- `redis`: internal-only deployment (`supportsPublic=false`).
- `postgres`: internal-only deployment (`supportsPublic=false`).

Other catalog entries are present but may return `501` from agent until implemented.

## Production Install (Ubuntu 22.04+ VPS)

One-command installer:

```bash
curl -fsSL https://raw.githubusercontent.com/selfyurt/selfyurt/main/install/install.sh | bash
```

Then:
1. Open panel from VPS IP (`http://<VPS_IP>`)
2. Set DNS `A` record for `panel.<domain>` to VPS IP
3. Add app subdomain `A` records to VPS IP
4. Deploy your first app from the Gallery

## Security Baseline

- Only ports `22`, `80`, `443` should be public
- Agent is internal-only on Docker network
- API to Agent calls require `X-SELFYURT-TOKEN`
- Session cookie is `HttpOnly` and signed

## Scripts

- `./scripts/dev.sh`
- `./scripts/dev-real.sh`
- `./scripts/build.sh`
- `./scripts/lint.sh`
- `./scripts/format.sh`
- `./scripts/release.sh`

## Docs

- `/Users/unallar/Desktop/Dev/selfyurt/docs/00-overview.md`
- `/Users/unallar/Desktop/Dev/selfyurt/docs/01-quickstart.md`
- `/Users/unallar/Desktop/Dev/selfyurt/docs/02-dns-and-domain.md`
- `/Users/unallar/Desktop/Dev/selfyurt/docs/03-security.md`
- `/Users/unallar/Desktop/Dev/selfyurt/docs/04-troubleshooting.md`
- `/Users/unallar/Desktop/Dev/selfyurt/docs/05-app-manifest-spec.md`

## License

MIT
