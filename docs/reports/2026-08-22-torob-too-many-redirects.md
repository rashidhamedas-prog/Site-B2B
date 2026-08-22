# 2026-08-22 — Torob TooManyRedirects

## Ticket

ترب هنگام دریافت اطلاعات محصول از API فروشگاه خطای TooManyRedirects گزارش کرد و خواست:

1. از هاست به `https://extractor.torob.com/health_check/` درخواست زده شود
2. رنج آی‌پی خزنده سفید باشد

## Evidence (before change)

| Check | Result |
|---|---|
| VPS → extractor health | HTTP 200, body `{"status":"ok"}` |
| `https://crawler.torob.com/ips-v4.json` | `81.12.31.192/27` … `/254`, `91.107.165.81/32`, `188.121.119.29/32`, `195.201.30.135/32` |
| UFW 80/443 | ALLOW from anywhere (not blocked) |
| fail2ban | only `sshd` jail |
| Live feed `https://www.poshaktaranom.ir/api/v1/feeds/torob.xml` | 200, 0 redirects |
| 57 product `<link>` URLs with TorobBot | all 200, 0 redirects |
| `/feeds/torob.xml` on retail host | **404** (Next.js, not API) |
| API trailing slash `/v1/products/slug/…/` | **404** |
| `api.poshaktaranom.com` | `limit_req` 30r/m per IP (burst 50) |
| TorobBot in Next `htmlLimitedBots` | **missing** — streamed shell, canonical flushed late |

No HTTP Location loop was reproduced on current feed URLs. Hardening targets the paths/bots/rate-limit that make Python `requests` report TooManyRedirects or fail extraction.

## Changes

- nginx `geo $torob_crawler` for official CIDRs; empty `$api_limit_key` skips API rate limit
- Exact locations `/feeds/torob.xml` and `/v1/feeds/torob.xml` proxy to API (200, no redirect)
- Next `htmlLimitedBots` includes `TorobBot|Torob-Bot`
- Fastify `ignoreTrailingSlash: true`

## Follow-up (H5 rewrite ping-pong)

Support still reported TooManyRedirects after the feed/IP pass. Live hop tracer **without** following HTTP redirects (debug session `9a3858`):

```
GET /products/linen-shirt-manteau-yaghoot  → 200  x-middleware-rewrite: /retail/products/...
GET /retail/products/linen-shirt-manteau-yaghoot → 301 Location: https://www.poshaktaranom.ir/products/...
→ REDIRECT_LOOP if the extractor follows x-middleware-rewrite
```

Standard `requests` (Location only) stays 200 / 0 hops — that is why the first sample looked clean.

Fix: middleware no longer 301s `/retail` or `/retail/*` to the public URL. Those paths return 200 + `x-robots-tag: noindex, nofollow`. Public `/products/{slug}` is still the canonical.

Owner: paste feed `https://www.poshaktaranom.ir/api/v1/feeds/torob.xml` and a **current** sample such as `https://www.poshaktaranom.ir/products/linen-shirt-manteau-yaghoot`. Re-sync the panel; ~1003 Webzi-era rows (e.g. شومیز سارا) are not in the live 57-item feed.

## Owner follow-up

در پنل ترب فید را روی یکی از این URLها (ترجیحاً اولی) ذخیره کنید، سپس همگام‌سازی را از نو بزنید:

- `https://www.poshaktaranom.ir/api/v1/feeds/torob.xml`
- `https://www.poshaktaranom.ir/feeds/torob.xml`
- `https://api.poshaktaranom.com/v1/feeds/torob.xml`
