-- Fix retail home products rail:
-- Live CMS had source=manual + curated IDs + inStockOnly=true → fewer cards than
-- limit (empty grid slot) and headline «همه محصولات» while only ≤12 show.
-- Switch to auto newest (perf cap 12), clear curation, honest headline, keep CTA.
UPDATE site_contents
SET
  blocks = (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN elem->>'type' = 'products' THEN
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(elem, '{props,source}', '"auto"'::jsonb, true),
                            '{props,productIds}',
                            '""'::jsonb,
                            true
                          ),
                          '{props,limit}',
                          '12'::jsonb,
                          true
                        ),
                        '{props,sort}',
                        '"newest"'::jsonb,
                        true
                      ),
                      '{props,inStockOnly}',
                      'false'::jsonb,
                      true
                    ),
                    '{props,categoryId}',
                    '""'::jsonb,
                    true
                  ),
                  '{props,headline}',
                  '"جدیدترین‌ها"'::jsonb,
                  true
                ),
                '{props,ctaHref}',
                to_jsonb(COALESCE(NULLIF(elem->'props'->>'ctaHref', ''), '/products')),
                true
              ),
              '{props,ctaLabel}',
              to_jsonb(
                COALESCE(
                  NULLIF(elem->'props'->>'viewAllLabel', ''),
                  NULLIF(elem->'props'->>'ctaLabel', ''),
                  'مشاهده همه محصولات'
                )
              ),
              true
            )
          ELSE elem
        END
        ORDER BY ordinality
      ),
      blocks
    )
    FROM jsonb_array_elements(blocks) WITH ORDINALITY AS t(elem, ordinality)
  ),
  "updatedAt" = NOW()
WHERE channel = 'RETAIL'
  AND "pageKey" = 'home'
  AND "isPublished" = true;
