# SEO, Analytics, and Performance

## SEO and URLs

Inventory indexed URLs, route patterns, parameters, canonicals, redirects, metadata, structured data, robots directives, sitemaps, pagination, locale, product availability, and error pages. Preserve valuable URLs; use tested server redirects for necessary changes. Prevent staging/private/wholesale-only pages from unintended indexing. Validate status codes, canonical consistency, structured data, sitemap freshness, and no redirect chains/loops.

## Analytics

Document event names, payload schemas, consent requirements, destinations, and business owners. Verify product view, search, add/remove cart, checkout steps, purchase (once only), refund/cancel, wholesale lead/quote/order as applicable. Never send secrets or unnecessary personal data. Compare key events before/after changes.

## Performance and accessibility

Capture reproducible baselines for representative retail/wholesale pages and critical APIs using production-like data. Set repository-specific budgets for server latency, queries, payloads, images, cache behavior, and user-centric web metrics. Fix measured bottlenecks without changing correctness. Test keyboard use, focus, labels, errors, contrast, responsive layouts, and reduced motion on critical journeys.

Acceptance requires no material regression against recorded baseline/budgets, with deviations explicitly accepted and tracked.

Record baseline evidence and measurement commands during preflight or the first checkpoint. Claim route, metadata, analytics-schema, and performance-sensitive files before changes; update handoff with URL/event compatibility impact.
