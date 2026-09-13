# Security

## Why the agent is internal-only

Agent can manage Docker and has access to Docker socket.
Exposing it publicly would allow remote container control if compromised.

SelfYurt protects this by:

- No published agent port in Docker Compose
- Private Docker network communication only
- `X-SELFYURT-TOKEN` required on all agent endpoints

## Why database apps are internal-only in MVP

`postgres` and `redis` are intentionally marked `supportsPublic=false`.
This prevents accidental exposure of raw database ports to the internet and reduces blast radius for single-VPS installs.

If an app is internal-only:

- API rejects `exposePublic=true`
- Agent does not write Caddy route snippets
- UI shows `internalEndpoint` instead of public URL

## Firewall baseline

Allow only:

- `22/tcp` SSH
- `80/tcp` HTTP
- `443/tcp` HTTPS

Block all other inbound ports.

## Admin password rotation

For MVP, admin credentials are seeded from env. To rotate:

1. Change password in DB/API flow (or recreate admin bootstrap after controlled reset)
2. Rotate `SELFYURT_SESSION_SECRET`
3. Restart stack

## Backups

Back up:

- `/opt/selfyurt` repository and `.env`
- Docker volumes:
  - `selfyurt_db`
- app data volumes created by deployments
- `selfyurt_caddy_data`

## Mock mode note

Local `AGENT_MODE=mock` is for development UX only.
Do not treat mock deploy success as production runtime verification.
