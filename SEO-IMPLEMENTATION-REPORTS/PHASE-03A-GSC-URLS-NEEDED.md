# PHASE 03A — GSC URLS NEEDED

Search Console exports of **exact affected URLs** are not in this repository. Counts below are from the PHASE-03A brief (export dated 2026-08-22). Live site evidence cannot substitute for those URL lists.

Format: Search Console > Indexing > Pages > \<reason\> > View data about affected pages > Export

---

## Crawled - currently not indexed (13)

- current count: 13
- why exact URLs are needed: this bucket is quality/selection, not a single technical defect. Live sitemap has 77 technically clean 200/self-canonical/indexable URLs; which 13 Google already crawled cannot be identified without the export. Content rewrites are out of this phase.

## Not found (404) (33)

- current count: 33
- why exact URLs are needed: live public HTML crawl found **0** internal links to 404. Historical WP/sku paths exist in code (`/product/`, slug maps) but mapping 33 GSC rows to KEEP vs 301 requires the actual URLs. Mass homepage 301 is forbidden.

## Duplicate without user-selected canonical (1)

- current count: 1
- why exact URLs are needed: several duplicate *classes* exist (host, `/retail`, query). The single GSC pair is unknown. No speculative extra redirect.

## Blocked due to access forbidden (403) (1)

- current count: 1
- why exact URLs are needed: census found no public 403 HTML. Could be API, WAF, or a private path. Do not special-case Googlebot UA.

## Blocked by robots.txt (1)

- current count: 1
- why exact URLs are needed: several Disallow rules are intentional. Cannot tell if this one is `/account` (correct) or a public page (bug) without the URL.

## Discovered - currently not indexed (1)

- current count: 1
- why exact URLs are needed: could be a new/orphan URL. Sitemap inclusion and inlinks cannot be checked without the URL. Do not auto-request indexing.

---

## Mapped without GSC URL export (NO_EXPORT_NEEDED for *class*, not for the exact GSC row)

| Reason | Live class mapping | Export still needed for the exact GSC URLs? |
|---|---|---|
| Page with redirect (65) | host HTTP/apex, `/search` `/shop`, product slug maps, `/retail` is **not** a redirect | YES if we must 1:1 each of the 65; systemic classes are documented in `PHASE-03A-REDIRECT-MAP.csv` |
| Excluded by `noindex` (43) | account/checkout/admin, `/products?…`, `/retail` header | YES for the exact 43; classes are in `PHASE-03A-NOINDEX-MAP.csv` |
| Alternate page with proper canonical (3) | query listings + possible `/retail` | YES to confirm; likely NO_ACTION_EXPECTED |

Do not invent sample URLs.
