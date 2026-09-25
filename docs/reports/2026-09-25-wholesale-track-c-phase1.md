# Wholesale Track C — Phase 1 SEO + catalog UX (2026-09-25)

## Decision
Owner chose Track C (SEO/content + UX redesign, phased).

## Runtime baseline (Node fetch, proxy 10808)

- Home: 200, FAQPage present, 12 product cards, 1 H1, canonical apex
- `/products?page=2`: 200, robots still `index,follow` in SSR HTML, canonical `/products`
- Blog search: `noindex,follow` OK
- Blog sitemap: 6 URLs

## Hypotheses

| ID | Claim | Result |
| --- | --- | --- |
| H1 | `force-static` products metadata always indexes query URLs | CONFIRMED (code + probe) |
| H2 | Home FAQPage comes from `WholesaleFaq` → `FaqJsonLd` | CONFIRMED |
| H3 | Client `<meta noindex>` for page>1 is not in initial HTML | CONFIRMED |

## Changes (this slice)

- `WholesaleFaq.tsx`: remove FAQPage JSON-LD; keep visible Q&A
- `wholesale-manto-mashhad/page.tsx`: remove FAQPage JSON-LD
- `products/page.tsx`: drop `force-static`; utility query → `noindex,follow` + canonical `/products`
- `wholesale-catalog-seo.ts` + spec
- Catalog UX: MOQ line on cards; MOQ/approval chip under catalog H1

## Not done yet

- Home visual redesign beyond FAQ schema
- Weblog content briefs / new posts (owner copy required)
- GSC baseline (Wizard trial ended)
- Deploy (needs owner commit approval + retail claim coexistence on WORKLOG)

## Gates observed

- `wholesale-catalog-seo.spec.mts`: run locally in this session
