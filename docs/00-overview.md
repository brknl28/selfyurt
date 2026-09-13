# SelfYurt Overview

SelfYurt is a single-VPS self-hosting control plane.

Core parts:

- **Caddy**: public reverse proxy on ports 80/443
- **Web Panel**: Vite React UI
- **API**: Fastify + Prisma + SQLite
- **Agent**: internal-only Go service with Docker socket access

High-level flow:

1. Install SelfYurt on Ubuntu 22.04+
2. Open panel via VPS IP over HTTP
3. Add DNS records for panel/app hostnames
4. Deploy apps from App Gallery
5. Caddy serves panel and app subdomains
