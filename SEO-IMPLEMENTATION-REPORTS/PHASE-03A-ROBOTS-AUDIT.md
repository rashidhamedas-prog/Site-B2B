# PHASE 03A — ROBOTS AUDIT
Date: 2026-08-23
Live `https://www.poshaktaranom.ir/robots.txt` HTTP 200.

```
User-Agent: *
Allow: /
Allow: /api/v1/feeds/
Disallow: /admin/
Disallow: /portal/
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /login
Disallow: /payment/
Disallow: /blog/search
Disallow: /blog/preview

Sitemap: https://www.poshaktaranom.ir/sitemap.xml
```

## Disallow rules

| pattern | purpose | sample | index_intent | correct? |
|---|---|---|---|---|
| `/admin/` | staff UI | `/admin` | PRIVATE | YES |
| `/portal/` | wholesale portal | `/portal` | PRIVATE | YES |
| `/api/` | API (feeds allowed separately) | `/api/v1/...` | PRIVATE | YES |
| `/api/v1/feeds/` Allow | Torob/merchant XML | `/api/v1/feeds/torob.xml` | NOINDEX via nginx X-Robots-Tag | YES |
| `/cart` | cart | `/cart` | PRIVATE | YES |
| `/checkout` | checkout | `/checkout` | PRIVATE | YES — page also noindex in layout |
| `/account` | account | `/account` | PRIVATE | YES — page also noindex |
| `/login` | auth | `/login` | PRIVATE | YES |
| `/payment/` | payment return | `/payment/callback` | PRIVATE | YES |
| `/blog/search` | blog search | `/blog/search` | NOINDEX | YES |
| `/blog/preview` | draft preview | `/blog/preview/...` | NOINDEX | YES |

## Not disallowed (intentional)

| path | why |
|---|---|
| `/retail/*` | Must stay crawlable so Google can see `X-Robots-Tag: noindex`. Do **not** Disallow. |
| `/products?…` | noindex via meta; blocking in robots.txt would hide the noindex tag |

## GSC “Blocked by robots.txt” (1 URL)

Exact URL unknown. Candidates that **are** Disallow and should stay blocked: `/account`, `/checkout`, `/admin/`, `/api/` (non-feed).

If the GSC URL is a public indexable path, that would be accidental — **cannot confirm without export**. No robots.txt change in this phase.

## 403 (1 GSC URL)

No public HTML URL in the live census returned 403. Nginx `limit_req` is on the API vhost, default 503 not 403. Auth gates redirect rather than 403 for HTML.

Exact GSC URL required. No Googlebot UA exception added.
