# PHASE 03A — SUMMARY
Date: 2026-08-23
Production: `https://www.poshaktaranom.ir` at `13bf657` (PHASE-02B). Repo patches for 03A **not deployed**.

Current sitemap URLs:
77

Index-intended URLs:
77

Intentional noindex/private URLs:
6 patterns (`/account*`, `/checkout*`, `/admin/*`, `/products?*`, `/retail/*`, `/blog/search|preview`) — 14 live samples crawled (account + filtered `/products?`)

Intentional redirects:
4 verified live classes (HTTP www→HTTPS www; HTTPS apex→www; `/search`→`/products`; `/shop`→`/products`) plus product slug maps in code (not GSC-enumerated)

Live broken internal links found:
0 (public HTML crawl of 1027 links / 105 owned targets)

Live broken internal links fixed:
2 (`RetailOtpLogin` `/retail/checkout` and `/retail/products` → public paths; not in public nav HTML)

Sitemap invalid URLs found:
0

Sitemap invalid URLs fixed:
0

Redirect chains found:
1 (`http://poshaktaranom.ir/` → HTTPS apex → HTTPS www)

Redirect chains fixed:
1 in repo (`nginx/nginx.conf` hardcoded one-hop). **Live still 2 hops** (no deploy)

Accidental noindex found:
0

Accidental robots blocks found:
0

Current live 404 references:
0 internal HTML hrefs to 404

Legitimate 404:
1 probe (`/this-page-does-not-exist-p03a`) plus unknown GSC set of 33

404 needing redirect:
0 evidenced (GSC 33 URLs not in repo)

Crawled-not-indexed candidates:
77 technically clean sitemap URLs (which of the GSC 13 is unknown)

Potential duplicate canonical classes:
5 (apex/www, http/https, `/retail` vs public, query listings, wholesale `.com` footer)

Exact GSC sample exports still needed:
- Crawled - currently not indexed (13)
- Not found 404 (33)
- Duplicate without user-selected canonical (1)
- Blocked due to access forbidden 403 (1)
- Blocked by robots.txt (1)
- Discovered - currently not indexed (1)
