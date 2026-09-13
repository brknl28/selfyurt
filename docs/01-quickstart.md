# Quickstart

## Requirements

- Ubuntu 22.04+ VPS
- SSH root/sudo access
- A domain you control

## One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/selfyurt/selfyurt/main/install/install.sh | bash
```

## First login

1. Installer prints `http://<VPS_IP>` and admin credentials.
2. Open the panel URL.
3. Sign in with installer credentials.

## Configure DNS

1. Add `A` record: `panel.<your-domain>` -> `VPS_IP`
2. Add `A` records for app subdomains (e.g. `hello.<your-domain>`) -> `VPS_IP`

## Deploy first app

1. Open **Gallery**
2. Choose **Hello (nginx-hello)**
3. Enter `instanceId` and hostname
4. Click **Deploy**
5. Open deployed URL
