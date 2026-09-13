# DNS and Domain

## Required records

Minimum for panel + one app:

- `A panel.<domain> -> VPS_IP`
- `A app.<domain> -> VPS_IP`

For many apps, you can add each subdomain explicitly.

## Optional wildcard

You can also use:

- `A *.domain.com -> VPS_IP`

MVP does not require wildcard.

## Common mistakes

- Pointing to wrong IP address
- Using `CNAME` at apex incorrectly
- Forgetting TTL/propagation delay
- Testing before DNS propagation completes

## Verify

```bash
dig +short panel.<domain>
nslookup panel.<domain>
```

Both should resolve to your VPS public IP.
