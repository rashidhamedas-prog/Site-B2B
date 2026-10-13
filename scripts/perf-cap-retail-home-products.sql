-- Cap retail home product block to 12 (performance) and keep source honest.
UPDATE site_contents
SET blocks = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN elem->>'type' = 'products' THEN
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(elem, '{props,limit}', '12'::jsonb, true),
                    '{props,source}',
                    '"auto"'::jsonb,
                    true
                  ),
                  '{props,productIds}',
                  '""'::jsonb,
                  true
                ),
                '{props,headline}',
                to_jsonb(
                  CASE
                    WHEN COALESCE(elem->'props'->>'headline', '') IN ('همه محصولات', '')
                      THEN 'جدیدترین‌ها'
                    ELSE elem->'props'->>'headline'
                  END
                ),
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
        WHEN elem->>'type' = 'categoryBanners' THEN
          jsonb_set(elem, '{props,maxItems}', '10'::jsonb, true)
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
