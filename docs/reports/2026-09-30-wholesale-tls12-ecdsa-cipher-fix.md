# 2026-09-30 — Wholesale (and retail) TLS 1.2 outage

## Symptom

`poshaktaranom.com` appeared down for many clients (especially Windows / Schannel).
Browsers on TLS 1.3 often still loaded the page. API health stayed green.

## Root cause

1. Let's Encrypt leaf for `.com` / `.ir` is **ECDSA** (chain YE2 → Root YE → ISRG X2).
2. Canonical storefront server blocks set:

   `ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;`

3. RSA-only suites cannot complete a TLS 1.2 handshake against an ECDSA leaf →
   `handshake failure` / Windows `SEC_E_ILLEGAL_MESSAGE`.
4. TLS 1.3 still worked (cipher negotiation is separate), which masked the outage
   for Chromium while older or TLS-1.2-preferring clients failed.
5. `www.poshaktaranom.com` had no restrictive `ssl_ciphers` (TLS 1.2 OK) but
   **301 → apex**, so successful www clients still landed on the broken apex.

Same RSA-only list broke `www.poshaktaranom.ir` TLS 1.2.

## Fix

- Replace cipher lists on wholesale apex + retail www with suites that include
  **ECDHE-ECDSA** (and keep ECDHE-RSA for future RSA leaves).
- `scripts/auto-deploy.sh`: `docker compose up -d nginx --no-deps --force-recreate`
  so single-file bind mounts of `nginx.conf` remount after inode replace
  (`git reset` / rewrite). Plain reload kept a stale inode during the hotfix.

## Evidence (live)

| Probe | Result |
|-------|--------|
| `openssl … -servername poshaktaranom.com -tls1_2` | `ECDHE-ECDSA-AES256-GCM-SHA384` |
| `openssl … -servername www.poshaktaranom.ir -tls1_2` | `ECDHE-ECDSA-AES256-GCM-SHA384` |
| Windows `curl.exe https://poshaktaranom.com/` | **200** |
| Windows `curl.exe https://www.poshaktaranom.ir/` | **200** |
| `GET /v1/health` | **200** |

## Architecture note

Edge TLS cipher lists must match the **leaf key type**. Prefer a shared
nginx SSL snippet for all HTTPS server blocks; do not copy RSA-only Mozilla
lists onto ECDSA certificates. After renewals, verify TLS 1.2 and TLS 1.3
separately for apex + www on both channels.
