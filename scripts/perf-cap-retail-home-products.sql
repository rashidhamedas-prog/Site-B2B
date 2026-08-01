-- Cap retail home product block to 12 (performance).
UPDATE site_contents
SET blocks = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN elem->>'type' = 'products' THEN
          jsonb_set(
            jsonb_set(elem, '{props,limit}', '12'::jsonb, true),
            '{props,headline}',
            to_jsonb(COALESCE(elem->'props'->>'headline', 'جدیدترین‌ها')),
            true
          )
        WHEN elem->>'type' = 'categoryBanners' THEN
          jsonb_set(elem, '{props,maxItems}', '10'::jsonb, true)
        ELSE elem
      END
    ),
    blocks
  )
  FROM jsonb_array_elements(blocks) AS elem
),
"updatedAt" = NOW()
WHERE channel = 'RETAIL'
  AND "pageKey" = 'home'
  AND "isPublished" = true;
