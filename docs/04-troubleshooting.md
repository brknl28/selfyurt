# Troubleshooting

## Panel not loading

- Check containers:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
```

- Check Caddy logs:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs caddy
```

## `/api` calls returning 404 in local web dev

If `http://localhost:5173/api/...` returns HTML instead of JSON, API is not reachable via Vite proxy.

Check:

- API running on `http://127.0.0.1:8787`
- `packages/web/vite.config.ts` proxy target is `http://127.0.0.1:8787`
- Browser opened from `http://localhost:5173` (not static file mode)

Quick check:

```bash
curl -i http://127.0.0.1:8787/api/health
```

## Login fails after changing env credentials

Admin bootstrap runs only on first DB creation.
If user already exists, changing `ADMIN_EMAIL` / `ADMIN_PASSWORD` env does not overwrite existing credentials.

For local reset:

```bash
rm -f packages/api/dev-selfyurt.db
rm -f /tmp/selfyurt-mock-agent.json
```

Then restart dev scripts.

## DNS not resolving

- Validate records with `dig`/`nslookup`
- Ensure domain points to correct VPS IP

## TLS pending

- Ensure `panel.<domain>` resolves publicly
- Ensure ports 80/443 are open
- Check Caddy logs for ACME errors

## Docker not running

```bash
systemctl status docker
systemctl restart docker
```

## Ports in use

If 80/443 are occupied, stop conflicting services:

```bash
ss -ltnp | grep -E ':80|:443'
```

## Agent unreachable

- Real mode:
  - ensure go-agent is running on `http://127.0.0.1:7070`
  - ensure API `AGENT_MODE=real`
  - ensure `AGENT_TOKEN` matches on API and agent
- Mock mode:
  - set `AGENT_MODE=mock` (default in `./scripts/dev.sh`)
  - no go-agent process is required

## Expected behavior in mock mode

- `nginx-hello` deploy returns simulated public URL
- `postgres` / `redis` deploy returns simulated internal endpoint
- logs and lifecycle actions are persisted in `/tmp/selfyurt-mock-agent.json`
