# App Manifest Spec (MVP)

Each app manifest is YAML in `apps/catalog/*.yml`.

Required top-level fields:

- `id`
- `name`
- `description`
- `category`
- `compose`
- `ingress`
- `access`
- `envSchema`
- `volumes`

Optional:

- `icon`
- `notes`

## Schema

```yaml
id: string
name: string
description: string
category: string
icon: string (optional)
compose:
  template: string (compose YAML template)
  variables:
    - key: string
      required: boolean (optional)
ingress:
  targetService: string
  targetPort: integer
access:
  defaultExposePublic: boolean (optional, default = supportsPublic)
  supportsPublic: boolean (optional, default = true)
  protocol: http | tcp (optional, default = http)
envSchema:
  - key: string
    label: string
    required: boolean
    default: string (optional)
    secret: boolean (optional)
volumes:
  - name: string
    mountPath: string
    keepOnUninstall: boolean (optional, default true)
notes: string (optional)
```

## Access behavior

- `supportsPublic=false` means API must reject `exposePublic=true`.
- `defaultExposePublic` is used by UI to initialize deploy form toggle.
- `protocol=http` allows Caddy HTTP reverse proxy when `exposePublic=true`.
- `protocol=tcp` is currently internal-only in MVP (no public TCP/L4 routing).

## Template placeholders

MVP template rendering supports string replacement tokens:

- `{{INSTANCE_ID}}`
- `{{HOSTNAME}}`
- `{{<ENV_KEY>}}`

## Example (nginx-hello)

```yaml
id: nginx-hello
name: Hello
description: Minimal hello app for validating deploy and ingress flow.
category: utility
compose:
  template: |
    services:
      app:
        image: nginxdemos/hello:plain-text
        container_name: sy-{{INSTANCE_ID}}-app
        restart: unless-stopped
        networks:
          - selfyurt_net
    networks:
      selfyurt_net:
        external: true
ingress:
  targetService: app
  targetPort: 80
access:
  defaultExposePublic: true
  supportsPublic: true
  protocol: http
envSchema: []
volumes: []
```

## Example (redis internal-only)

```yaml
id: redis
name: Redis
description: Redis cache/key-value store.
category: database
compose:
  template: |
    services:
      redis:
        image: redis:7-alpine
        container_name: sy-{{INSTANCE_ID}}-redis
        restart: unless-stopped
        command: ["redis-server", "--appendonly", "yes"]
        volumes:
          - {{INSTANCE_ID}}_data:/data
        networks:
          - selfyurt_net
    volumes:
      {{INSTANCE_ID}}_data:
    networks:
      selfyurt_net:
        external: true
ingress:
  targetService: redis
  targetPort: 6379
access:
  defaultExposePublic: false
  supportsPublic: false
  protocol: tcp
envSchema: []
volumes:
  - name: data
    mountPath: /data
    keepOnUninstall: true
```
